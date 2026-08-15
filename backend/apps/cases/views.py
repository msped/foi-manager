from django.shortcuts import get_object_or_404
from django.utils.timezone import now
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
from .permissions import IsFOITeam
from .serializers import (
    BankHolidaySerializer,
    CaseDetailSerializer,
    CaseListSerializer,
    CaseTransitionSerializer,
    DepartmentSerializer,
    EmailTemplateSerializer,
    MailboxSerializer,
    PublicCaseSubmitSerializer,
    PublicCaseTrackSerializer,
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


class PublicCaseSubmitView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PublicCaseSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case = serializer.save(received_by=Case.ReceivedBy.PORTAL)
        return Response(
            {"ref": case.ref, "status": case.status}, status=status.HTTP_201_CREATED
        )


class PublicCaseTrackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        ref = request.query_params.get("ref", "")
        email = request.query_params.get("email", "")
        case = get_object_or_404(Case, ref=ref, requester_email__iexact=email)
        serializer = PublicCaseTrackSerializer(case)
        return Response(serializer.data)


class CaseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CaseDetailSerializer

    def get_queryset(self):
        qs = Case.objects.select_related(
            "assignee",
            "created_by",
            "disclosure_log_entry",
            "disclosure_log_entry__published_by",
            "disclosure_log_entry__rejected_by",
        )
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
            qs = qs.filter(statutory_deadline__lt=now().date()).exclude(
                status__in=Case.TERMINAL_STATUSES
            )
        return qs

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
