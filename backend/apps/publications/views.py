from django.db.models import F, Q
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.cases.models import Case, CaseExemption, CaseResponse
from apps.cases.permissions import IsFOITeam

from .models import DisclosureLogEntry, PublicationSchemeEntry
from .serializers import (
    DisclosureLogEntrySerializer,
    DisclosureLogListSerializer,
    PublicationSchemeEntrySerializer,
    PublicDisclosureLogDetailSerializer,
    PublicDisclosureLogListSerializer,
    PublishQueueItemSerializer,
    RejectedQueueItemSerializer,
)


class DisclosureLogPagination(PageNumberPagination):
    """Smaller pages than the project default. Each disclosure log result
    carries a summary and exemption tags, so 25 makes for a very long page."""

    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class PublicationSchemePagination(PageNumberPagination):
    """Keeps the project default page size — the API tests assert on it — but
    lets the portal ask for the whole scheme at once, since it renders every
    entry grouped under its category rather than a page at a time."""

    page_size_query_param = "page_size"
    max_page_size = 200


class PublicDisclosureLogViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Read-only view of published disclosure log entries for the public portal.

    Unauthenticated by design. `authentication_classes` is emptied so a stale
    JWT from a signed-in staff member can never turn a 401 into a broken page.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    pagination_class = DisclosureLogPagination

    def get_serializer_class(self):
        if self.action == "list":
            return PublicDisclosureLogListSerializer
        return PublicDisclosureLogDetailSerializer

    def get_queryset(self):
        qs = (
            DisclosureLogEntry.objects.filter(
                status=DisclosureLogEntry.Status.PUBLISHED
            )
            .select_related("case")
            .prefetch_related("exemptions", "attachments")
        )

        params = self.request.query_params

        if search := params.get("search", "").strip():
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(summary__icontains=search)
                | Q(response_text__icontains=search)
                | Q(case__ref__icontains=search)
            )

        if exemption := params.get("exemption", "").strip():
            # M2M join can duplicate rows when an entry cites the same code twice
            # across cases; distinct() keeps one row per entry.
            qs = qs.filter(exemptions__code=exemption).distinct()

        if year := params.get("year", "").strip():
            if year.isdigit():
                qs = qs.filter(date_responded__year=int(year))

        # Entries awaiting a response date sort last rather than first, which is
        # what a plain "-date_responded" gives on Postgres.
        return qs.order_by(F("date_responded").desc(nulls_last=True), "-published_at")

    @action(detail=False, methods=["get"], url_path="filters")
    def filters(self, request):
        """Filter options that actually match something, so the UI never offers
        a dropdown value that returns nothing."""
        published = DisclosureLogEntry.objects.filter(
            status=DisclosureLogEntry.Status.PUBLISHED
        )

        codes = (
            CaseExemption.objects.filter(disclosure_log_entries__in=published)
            .values_list("code", flat=True)
            .distinct()
        )
        labels = dict(CaseExemption.Code.choices)

        years = sorted(
            {
                d.year
                for d in published.values_list("date_responded", flat=True)
                if d is not None
            },
            reverse=True,
        )

        return Response(
            {
                "exemptions": [
                    {"code": c, "code_display": labels.get(c, c)}
                    for c in sorted(set(codes))
                ],
                "years": years,
            }
        )


class PublicationSchemeEntryViewSet(viewsets.ModelViewSet):
    serializer_class = PublicationSchemeEntrySerializer
    pagination_class = PublicationSchemePagination

    def get_queryset(self):
        qs = PublicationSchemeEntry.objects.all()
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [AllowAny()]
        return [IsAuthenticated(), IsFOITeam()]


class DisclosureLogEntryViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = DisclosureLogEntrySerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        return [IsAuthenticated(), IsFOITeam()]

    def get_queryset(self):
        return DisclosureLogEntry.objects.select_related(
            "case", "published_by", "created_by", "rejected_by"
        ).prefetch_related("exemptions", "attachments")

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset().filter(status=DisclosureLogEntry.Status.PUBLISHED)
        serializer = DisclosureLogListSerializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="queue")
    def queue(self, request):
        cases = (
            Case.objects.filter(responses__status=CaseResponse.Status.SENT)
            .exclude(
                disclosure_log_entry__status__in=[
                    DisclosureLogEntry.Status.PUBLISHED,
                    DisclosureLogEntry.Status.REJECTED,
                ]
            )
            .distinct()
            .prefetch_related(
                "responses", "exemptions", "documents", "disclosure_log_entry"
            )
            .order_by("-submitted_at")
        )
        serializer = PublishQueueItemSerializer(cases, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="rejected")
    def rejected(self, request):
        qs = self.get_queryset().filter(status=DisclosureLogEntry.Status.REJECTED)
        serializer = RejectedQueueItemSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        entry = self.get_object()
        if entry.status == DisclosureLogEntry.Status.PUBLISHED:
            return Response(
                {"detail": "Already published."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry.status = DisclosureLogEntry.Status.PUBLISHED
        entry.published_by = request.user
        entry.published_at = timezone.now()
        entry.save()
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        entry = self.get_object()
        if entry.status != DisclosureLogEntry.Status.PUBLISHED:
            return Response(
                {"detail": "Not published."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry.status = DisclosureLogEntry.Status.DRAFT
        entry.published_by = None
        entry.published_at = None
        entry.save()
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        entry = self.get_object()
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response(
                {"detail": "Rejection reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry.status = DisclosureLogEntry.Status.REJECTED
        entry.rejection_reason = reason
        entry.rejected_by = request.user
        entry.rejected_at = timezone.now()
        entry.save()
        return Response(self.get_serializer(entry).data)

    @action(detail=False, methods=["post"], url_path="reject_case")
    def reject_case(self, request):
        case_id = request.data.get("case")
        reason = request.data.get("reason", "").strip()
        if not case_id:
            return Response(
                {"detail": "case is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not reason:
            return Response(
                {"detail": "Rejection reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            case = Case.objects.get(pk=case_id)
        except Case.DoesNotExist:
            return Response(
                {"detail": "Case not found."}, status=status.HTTP_404_NOT_FOUND
            )

        entry, _ = DisclosureLogEntry.objects.get_or_create(
            case=case,
            defaults={"created_by": request.user},
        )
        entry.status = DisclosureLogEntry.Status.REJECTED
        entry.rejection_reason = reason
        entry.rejected_by = request.user
        entry.rejected_at = timezone.now()
        entry.save()
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=["post"])
    def unreject(self, request, pk=None):
        entry = self.get_object()
        if entry.status != DisclosureLogEntry.Status.REJECTED:
            return Response(
                {"detail": "Not rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry.status = DisclosureLogEntry.Status.DRAFT
        entry.rejection_reason = ""
        entry.rejected_by = None
        entry.rejected_at = None
        entry.save()
        return Response(self.get_serializer(entry).data)
