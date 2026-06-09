from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.cases.models import Case, CaseResponse
from apps.cases.permissions import IsFOITeam

from .models import DisclosureLogEntry, PublicationSchemeEntry
from .serializers import (
    DisclosureLogEntrySerializer,
    DisclosureLogListSerializer,
    PublicationSchemeEntrySerializer,
    PublishQueueItemSerializer,
    RejectedQueueItemSerializer,
)


class PublicationSchemeEntryViewSet(viewsets.ModelViewSet):
    serializer_class = PublicationSchemeEntrySerializer

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
