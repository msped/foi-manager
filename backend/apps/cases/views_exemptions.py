from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import Case, CaseExemption
from .permissions import IsFOITeam
from .serializers import CaseExemptionSerializer


class CaseExemptionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CaseExemptionSerializer
    permission_classes = [IsAuthenticated, IsFOITeam]

    def _get_case(self):
        return get_object_or_404(Case, pk=self.kwargs['case_pk'])

    def get_queryset(self):
        return CaseExemption.objects.filter(case=self._get_case())

    def perform_create(self, serializer):
        serializer.save(case=self._get_case())
