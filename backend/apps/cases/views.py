from django.conf import settings as django_settings
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import submissions
from .models import (
    BankHoliday,
    Case,
    CaseClarification,
    Department,
    EmailTemplate,
    Mailbox,
    RequesterCategory,
    ResponseTemplate,
)
from .permissions import IsFOITeam, IsFOITeamOrAssignedAssignee
from .serializers import (
    BankHolidaySerializer,
    CaseDetailSerializer,
    CaseListSerializer,
    CaseTransitionSerializer,
    DepartmentSerializer,
    EmailTemplateSerializer,
    MailboxSerializer,
    PublicCaseSubmitSerializer,
    ReceiveClarificationSerializer,
    RequesterCategorySerializer,
    ResponseTemplateSerializer,
    SendClarificationSerializer,
)
from .tasks import (
    task_send_acknowledgement,
    task_send_case_assignment_notification,
    task_send_clarification_request,
)
from .utils import add_working_days


class PublicCaseSubmitView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PublicCaseSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # After validation, so the address being counted is a real one, and the
        # requester still gets told about a typo before being told about a
        # limit.
        email = serializer.validated_data["requester_email"]
        if submissions.is_throttled(email):
            # Says plainly that it refused, and where to go instead. The
            # tracking endpoint answers uniformly to avoid becoming a
            # membership oracle; the opposite applies here. There is nothing to
            # leak — the requester already knows what they sent — and a request
            # that disappears without saying so is the one outcome a statutory
            # service must not produce.
            return Response(
                {
                    "detail": (
                        "You have sent us several requests recently, so this "
                        "form has paused new ones from your email address for "
                        "a short while. You can still make a request by "
                        f"emailing {django_settings.FOI_CONTACT_EMAIL} — a "
                        "request sent by email is just as valid, and we will "
                        "treat it the same way."
                    )
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        case = serializer.save(received_by=Case.ReceivedBy.PORTAL)
        return Response(
            {"ref": case.ref, "status": case.status}, status=status.HTTP_201_CREATED
        )


class CaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CaseDetailSerializer

    def get_permissions(self):
        """Anyone signed in may read; only the FOI team may write.

        The same shape as ResponseTemplateViewSet and RequesterCategoryViewSet
        further down, and what CLAUDE.md has always described. It was missing
        here, which left create, update and destroy on `IsAuthenticated` alone —
        so an assignee could edit or delete any case in the service.

        Every @action on this viewset already declares `IsFOITeam`, and the
        write branch below returns the same thing, so overriding this does not
        loosen any of them.
        """
        if self.action in ("list", "retrieve", "stats"):
            return [IsAuthenticated(), IsFOITeamOrAssignedAssignee()]
        return [IsAuthenticated(), IsFOITeam()]

    def get_queryset(self):
        qs = Case.objects.select_related(
            "assignee",
            "created_by",
            "disclosure_log_entry",
            "disclosure_log_entry__published_by",
            "disclosure_log_entry__rejected_by",
        )

        # Scope before anything else. An assignee is a colleague in another
        # team who has been asked about one request; the rest of the queue is
        # not theirs to read, and it carries requester names and addresses.
        #
        # Done by narrowing the queryset rather than by refusing in a
        # permission class, so an unassigned case 404s instead of 403ing. A 403
        # would confirm the case exists, and refs are sequential enough to walk.
        # `views_notes.CaseNoteViewSet._get_case` scopes the same way.
        #
        # Every filter below only ever narrows further, so none of them can be
        # used to escape this line.
        if not self.request.user.is_foi_team():
            qs = qs.filter(assignee=self.request.user)

        params = self.request.query_params
        if status_filter := params.get("status"):
            qs = qs.filter(status=status_filter)
        if exclude_status := params.get("exclude_status"):
            qs = qs.exclude(status__in=[s.strip() for s in exclude_status.split(",")])
        if assignee := params.get("assignee"):
            qs = qs.filter(assignee=assignee)
        if params.get("unassigned") == "true":
            qs = qs.filter(assignee__isnull=True).exclude(
                status__in=Case.TERMINAL_STATUSES
            )
        if params.get("is_overdue") == "true":
            # Mirrors `Case.is_overdue`, including the paused-clock exclusion.
            qs = (
                qs.filter(statutory_deadline__lt=now().date())
                .exclude(status__in=Case.TERMINAL_STATUSES)
                .exclude(clock_paused=True)
            )
        if due_within := params.get("due_within_working_days"):
            # One BankHoliday walk to find the cutoff date, then a plain range
            # in SQL. `working_days_between` is Python and cannot be pushed into
            # a filter, so anything per-row would mean loading the whole queue.
            try:
                window = int(due_within)
            except ValueError:
                window = django_settings.FOI_DUE_SOON_WORKING_DAYS
            qs = self._due_within(qs, window)
        return qs

    @staticmethod
    def _due_within(qs, working_days: int):
        """Cases whose deadline falls between today and `working_days` ahead.

        Excludes terminal and paused cases for the same reason `is_overdue`
        does: neither is work with a deadline running against it.
        """
        today = now().date()
        return (
            qs.filter(
                statutory_deadline__gte=today,
                statutory_deadline__lte=add_working_days(today, working_days),
            )
            .exclude(status__in=Case.TERMINAL_STATUSES)
            .exclude(clock_paused=True)
        )

    def get_serializer_class(self):
        if self.action == "list":
            return CaseListSerializer
        return CaseDetailSerializer

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["pk"])
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        old_assignee_id = serializer.instance.assignee_id
        instance = serializer.save()
        new_assignee_id = instance.assignee_id
        if new_assignee_id and new_assignee_id != old_assignee_id:
            task_send_case_assignment_notification.delay(instance.pk, new_assignee_id)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """Point-in-time counts of work in flight, for the dashboard tiles.

        Built on `get_queryset`, so the assignee scoping there applies here as
        well — an assignee gets their own numbers rather than a 403 or the
        team's. That also means this takes the same query parameters as `list`:
        the dashboard asks for one person's queue with `?assignee=<id>`, and the
        same endpoint answers service-wide for the FOI team with no parameters.

        Every figure counts live work, and none of them takes a reporting
        period. A lifetime total only grows, so it stops distinguishing a busy
        month from a quiet one and stops being worth showing.
        """
        today = now().date()
        due_cutoff = add_working_days(
            today, django_settings.FOI_DUE_SOON_WORKING_DAYS
        )
        live = ~Q(status__in=Case.TERMINAL_STATUSES)
        # A paused clock is not running against a deadline, so it can be neither
        # overdue nor due soon. Matches `Case.is_overdue`.
        running = live & Q(clock_paused=False)

        # One query, five conditional counts — the alternative is a round trip
        # per tile, each scanning the same rows.
        return Response(
            self.get_queryset().aggregate(
                open=Count("id", filter=live),
                due_soon=Count(
                    "id",
                    filter=running
                    & Q(
                        statutory_deadline__gte=today,
                        statutory_deadline__lte=due_cutoff,
                    ),
                ),
                overdue=Count(
                    "id", filter=running & Q(statutory_deadline__lt=today)
                ),
                in_review=Count("id", filter=Q(status=Case.Status.REVIEW)),
                unassigned=Count("id", filter=live & Q(assignee__isnull=True)),
            )
        )

    @action(detail=True, methods=["post"], permission_classes=[IsFOITeam])
    def acknowledge(self, request, pk=None):
        case = get_object_or_404(Case, pk=pk)
        if case.status == Case.Status.ACKNOWLEDGED:
            return Response(
                {"detail": "Case is already acknowledged."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not EmailTemplate.objects.filter(
            purpose=EmailTemplate.Purpose.ACKNOWLEDGEMENT
        ).exists():
            return Response(
                {
                    "detail": 'The "Acknowledgement" email template is not configured. Set it up in Settings → Email Templates before continuing.'
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        case.acknowledge(actor=request.user)
        task_send_acknowledgement.delay(case.pk)
        return Response(CaseDetailSerializer(case).data)

    @action(detail=True, methods=["post"], permission_classes=[IsFOITeam])
    def transition(self, request, pk=None):
        case = get_object_or_404(Case, pk=pk)
        serializer = CaseTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case.transition_to(serializer.validated_data["status"], actor=request.user)
        return Response(CaseDetailSerializer(case).data)

    @action(detail=True, methods=["post"], permission_classes=[IsFOITeam])
    def pause_clock(self, request, pk=None):
        case = get_object_or_404(Case, pk=pk)
        case.pause_clock(reason=request.data.get("reason", ""), actor=request.user)
        return Response(CaseDetailSerializer(case).data)

    @action(detail=True, methods=["post"], permission_classes=[IsFOITeam])
    def resume_clock(self, request, pk=None):
        case = get_object_or_404(Case, pk=pk)
        case.resume_clock(actor=request.user)
        return Response(CaseDetailSerializer(case).data)

    @action(detail=True, methods=["get"], permission_classes=[IsFOITeam])
    def response_seed(self, request, pk=None):
        """Base letter + pre-rendered response blocks for seeding a new draft.

        Degrades gracefully when no case_response template exists so a config
        gap can never block statutory work.
        """
        from .email_utils import build_response_seed

        case = get_object_or_404(Case, pk=pk)
        return Response(build_response_seed(case))

    @action(detail=True, methods=["post"], permission_classes=[IsFOITeam])
    def send_clarification(self, request, pk=None):
        case = get_object_or_404(Case, pk=pk)
        if case.status == Case.Status.CLOSED:
            return Response(
                {"detail": "Cannot send clarification on a closed case."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if hasattr(case, "clarification") and case.clarification.received_at:
            return Response(
                {"detail": "Clarification has already been received for this case."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not EmailTemplate.objects.filter(
            purpose=EmailTemplate.Purpose.CLARIFICATION_REQUEST
        ).exists():
            return Response(
                {"detail": 'The "Clarification Request" email template is not configured. Set it up in Settings → Email Templates before continuing.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = SendClarificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        body = serializer.validated_data["body"]

        from datetime import date
        clarification, _ = CaseClarification.objects.get_or_create(case=case)
        clarification.sent_at = date.today()
        clarification.save(update_fields=["sent_at"])

        case.pause_clock(reason="clarification_requested", actor=request.user)
        case.transition_to(Case.Status.WITH_APPLICANT, actor=request.user)
        task_send_clarification_request.delay(case.pk, body)
        return Response(CaseDetailSerializer(case).data)

    @action(detail=True, methods=["post"], permission_classes=[IsFOITeam])
    def receive_clarification(self, request, pk=None):
        case = get_object_or_404(Case, pk=pk)
        if case.status != Case.Status.WITH_APPLICANT:
            return Response(
                {"detail": "Case is not awaiting clarification."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ReceiveClarificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        received_at = serializer.validated_data["received_at"]
        notes = serializer.validated_data["notes"]

        clarification, _ = CaseClarification.objects.get_or_create(case=case)
        clarification.received_at = received_at
        clarification.notes = notes
        clarification.save(update_fields=["received_at", "notes"])

        # Reset clock: unpause and recalculate deadline from clarification date
        from django.conf import settings as django_settings

        from apps.cases.utils import add_working_days
        case.clock_paused = False
        case.clock_paused_at = None
        case.statutory_deadline = add_working_days(received_at, django_settings.FOI_STATUTORY_DAYS)
        case.status = Case.Status.ACKNOWLEDGED
        case.save()
        case._log(
            action="clarification_received",
            actor=request.user,
            detail={"received_at": received_at.isoformat()},
        )
        return Response(CaseDetailSerializer(case).data)


class ResponseTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = ResponseTemplateSerializer
    permission_classes = [IsAuthenticated, IsFOITeam]
    pagination_class = None

    def get_queryset(self):
        return ResponseTemplate.objects.all()

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsFOITeam()]


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None


class RequesterCategoryViewSet(viewsets.ModelViewSet):
    queryset = RequesterCategory.objects.all()
    serializer_class = RequesterCategorySerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsFOITeam()]


class BankHolidayViewSet(viewsets.ModelViewSet):
    serializer_class = BankHolidaySerializer
    permission_classes = [IsAuthenticated, IsFOITeam]
    pagination_class = None

    def get_queryset(self):
        qs = BankHoliday.objects.all()
        country = self.request.query_params.get("country")
        if country:
            qs = qs.filter(country=country)
        year = self.request.query_params.get("year")
        if year:
            qs = qs.filter(date__year=year)
        return qs


class MailboxViewSet(viewsets.ModelViewSet):
    serializer_class = MailboxSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list",):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsFOITeam()]

    def get_queryset(self):
        qs = Mailbox.objects.all()
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(email__icontains=search)
        return qs.distinct()


class EmailTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated, IsFOITeam]
    pagination_class = None

    def get_queryset(self):
        qs = EmailTemplate.objects.all()
        type_filter = self.request.query_params.get("type")
        if type_filter:
            qs = qs.filter(type=type_filter)
        return qs

    @action(detail=False, methods=["get"])
    def purposes(self, request):
        templates_by_purpose = {
            t.purpose: t for t in EmailTemplate.objects.exclude(purpose__isnull=True)
        }
        result = []
        for purpose, meta in EmailTemplate.PURPOSE_META.items():
            template = templates_by_purpose.get(purpose)
            result.append(
                {
                    "purpose": purpose,
                    "label": meta["label"],
                    "description": meta["description"],
                    "type": EmailTemplate.PURPOSE_TYPE_MAP[purpose],
                    "variables": meta["variables"],
                    "template": EmailTemplateSerializer(template).data
                    if template
                    else None,
                }
            )
        return Response(result)
