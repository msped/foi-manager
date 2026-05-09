from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import Case, CaseNote
from .serializers import CaseNoteSerializer


class CaseNoteViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CaseNoteSerializer
    permission_classes = [IsAuthenticated]

    def _get_case(self):
        user = self.request.user
        qs = Case.objects.all()
        if not user.is_foi_team():
            qs = qs.filter(assignee=user)
        return get_object_or_404(qs, pk=self.kwargs['case_pk'])

    def get_queryset(self):
        return CaseNote.objects.filter(case=self._get_case())

    def perform_create(self, serializer):
        serializer.save(case=self._get_case(), author=self.request.user)
