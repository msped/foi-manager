from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone

from apps.cases.models import Case, CaseResponse
from apps.cases.permissions import IsFOITeam
from .models import DisclosureLogEntry, PublicationSchemeEntry
from .serializers import (
    DisclosureLogEntrySerializer,
    PublicationSchemeEntrySerializer,
    PublishQueueItemSerializer,
)


class PublicationSchemeEntryViewSet(viewsets.ModelViewSet):
    serializer_class = PublicationSchemeEntrySerializer

    def get_queryset(self):
        qs = PublicationSchemeEntry.objects.all()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated(), IsFOITeam()]


class DisclosureLogEntryViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = DisclosureLogEntrySerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_permissions(self):
        return [IsAuthenticated(), IsFOITeam()]

    def get_queryset(self):
        return DisclosureLogEntry.objects.select_related(
            'case', 'published_by', 'created_by'
        ).prefetch_related('exemptions', 'attachments')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='queue')
    def queue(self, request):
        cases = (
            Case.objects.filter(responses__status=CaseResponse.Status.SENT)
            .exclude(disclosure_log_entry__is_published=True)
            .distinct()
            .prefetch_related('responses', 'exemptions', 'documents', 'disclosure_log_entry')
            .order_by('-submitted_at')
        )
        serializer = PublishQueueItemSerializer(cases, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        entry = self.get_object()
        if entry.is_published:
            return Response(
                {'detail': 'Already published.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry.is_published = True
        entry.published_by = request.user
        entry.published_at = timezone.now()
        entry.save()
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        entry = self.get_object()
        if not entry.is_published:
            return Response(
                {'detail': 'Not published.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry.is_published = False
        entry.published_by = None
        entry.published_at = None
        entry.save()
        return Response(self.get_serializer(entry).data)
