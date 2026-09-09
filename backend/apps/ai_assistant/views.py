import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.cases.models import Case
from apps.cases.permissions import IsFOITeam
from apps.cases.submissions import MAX_REQUEST_CHARS

from .public import suggest_published_entries
from .retrieval import case_insights
from .serializers import CaseInsightsSerializer, RequestSuggestionSerializer

logger = logging.getLogger(__name__)


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


class RequestSuggestionsView(APIView):
    """Published responses that may already answer a request being drafted.

    The one view in this app an anonymous caller can reach, and the opposite
    posture to the one above — worth reading the two together rather than
    assuming this file has a single rule.

    POST rather than GET, for two reasons that point the same way. The request
    text runs to thousands of characters, which is past what a query string
    should carry; and it is the requester's own words on a subject they have not
    yet decided to send us, so it does not belong in an access log, a referrer
    header or a proxy cache.

    `authentication_classes` is emptied for the same reason as
    `PublicDisclosureLogViewSet` — a stale staff JWT in the browser must not be
    able to turn this into a 401 on a public page.

    **Not throttled, and that is not yet settled.** Every other public endpoint
    here counts against something in the database: submissions against the
    requester's own cases, tracking against the verification ledger. This has
    neither. There is no identity at this point in the journey — the form has
    not been submitted and may never be — no `CACHES` backend to count in (see
    `apps.common.throttling` for why the default LocMemCache is not one), and no
    usable IP axis behind the production proxy. What bounds it instead is
    `MIN_QUERY_CHARS` on one side and `MAX_REQUEST_CHARS` on the other, plus
    `AI_EMBED_TIMEOUT_QUERY`, which caps the cost of a single call at a second
    and a half rather than capping the number of calls. That is a real gap, and
    it should be closed before this is reachable from the open internet rather
    than only from the portal's own server-side calls.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        text = str(request.data.get("request_text") or "")

        if len(text) > MAX_REQUEST_CHARS:
            # The same ceiling the submission endpoint applies, enforced here so
            # a payload sized to hurt the embedder cannot get in through the
            # cheaper door. Refused rather than truncated: the requester is
            # about to meet this limit on submission anyway, and quietly
            # embedding a fraction of a request would return suggestions matched
            # against something they never wrote.
            return Response(
                {
                    "detail": (
                        f"request_text must be {MAX_REQUEST_CHARS} characters or fewer."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        entries = suggest_published_entries(text)
        return Response(
            {"suggestions": RequestSuggestionSerializer(entries, many=True).data}
        )
