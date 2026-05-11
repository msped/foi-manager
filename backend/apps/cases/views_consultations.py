from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import Case, CaseConsultation
from .serializers import CaseConsultationSerializer


class CaseConsultationViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CaseConsultationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete']

    def _get_case(self):
        user = self.request.user
        qs = Case.objects.all()
        if not user.is_foi_team():
            qs = qs.filter(assignee=user)
        return get_object_or_404(qs, pk=self.kwargs['case_pk'])

    def get_queryset(self):
        return CaseConsultation.objects.filter(
            case=self._get_case()
        ).select_related('department', 'assignee', 'created_by')

    def perform_create(self, serializer):
        serializer.save(case=self._get_case(), created_by=self.request.user)
