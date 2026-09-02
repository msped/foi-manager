from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cases.models import Case
from apps.cases.permissions import IsFOITeam

from .retrieval import case_insights
from .serializers import CaseInsightsSerializer


class CaseInsightsView(APIView):
    """Precedent and exemption history for one case.

    `IsFOITeam` rather than `IsAuthenticated`. The case list is deliberately
    scoped so an assignee sees only their own cases; this returns cases selected
    by resemblance, which would otherwise let any authenticated user pull back
    requester details from cases they were never given.

    Read-only and derived — every field is recomputed from the cases and
    published entries the caller could already reach, so there is nothing here
    to cache beyond the vectors themselves.
    """

    permission_classes = [IsAuthenticated, IsFOITeam]

    def get(self, request, case_id):
        case = get_object_or_404(Case, pk=case_id)
        return Response(CaseInsightsSerializer(case_insights(case)).data)
