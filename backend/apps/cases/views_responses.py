from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Case, CaseResponse
from .permissions import IsFOITeam
from .serializers import CaseResponseSerializer
from .tasks import task_send_case_response


class CaseResponseViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CaseResponseSerializer
    permission_classes = [IsAuthenticated, IsFOITeam]
    http_method_names = ['get', 'post', 'patch']

    def _get_case(self):
        return get_object_or_404(Case, pk=self.kwargs['case_pk'])

    def get_queryset(self):
        return CaseResponse.objects.filter(
            case=self._get_case()
        ).select_related('created_by')

    def perform_create(self, serializer):
        serializer.save(case=self._get_case(), created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def send(self, request, case_pk=None, pk=None):
        case_response = self.get_object()
        if case_response.status in (CaseResponse.Status.SENT, CaseResponse.Status.SENDING):
            return Response(
                {'detail': 'This response has already been sent or is currently sending.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        case_response.status = CaseResponse.Status.SENDING
        case_response.save(update_fields=['status'])
        task_send_case_response.delay(case_response.pk)
        return Response({'detail': 'Response queued for sending.'})
