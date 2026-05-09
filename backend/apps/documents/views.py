from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from apps.cases.models import Case
from .models import CaseDocument
from .serializers import CaseDocumentSerializer


class CaseDocumentViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = CaseDocumentSerializer
    permission_classes = [IsAuthenticated]

    def _get_case(self):
        user = self.request.user
        qs = Case.objects.all()
        if not user.is_foi_team():
            qs = qs.filter(assignee=user)
        return get_object_or_404(qs, pk=self.kwargs['case_pk'])

    def get_queryset(self):
        case = self._get_case()
        return CaseDocument.objects.filter(case=case)

    def perform_create(self, serializer):
        case = self._get_case()
        serializer.save(case=case, uploaded_by=self.request.user)
