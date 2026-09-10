"""Shapes for the internal insights panel.

No similarity scores anywhere. They exist — the ordering is built from them —
but a number like 0.62 next to a suggestion reads as a measurement of relevance
and is nothing of the sort: the range shifts with the model, with the prefixes,
and with how long the two texts happen to be. Rank order carries everything an
officer can act on, and claims only what it can support.

No requester details either, which is worth keeping that way. This endpoint
returns cases selected by resemblance rather than by assignment, so it is the
one place in the service where an officer sees records they were not given.
Carrying nothing about who sent them keeps that exposure to the request and its
outcome — the parts that are actually precedent.
"""

from rest_framework import serializers

PREVIEW_LENGTH = 300


def _preview_text(text: str) -> str:
    """Enough of a request to judge a suggestion without opening it."""
    text = (text or "").strip()
    if len(text) <= PREVIEW_LENGTH:
        return text
    return text[:PREVIEW_LENGTH].rsplit(" ", 1)[0] + "…"


def _preview(case) -> str:
    return _preview_text(case.summary or case.request_text)


class SimilarCaseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    ref = serializers.CharField()
    status = serializers.CharField()
    status_display = serializers.CharField(source="get_status_display")
    outcome = serializers.CharField()
    outcome_display = serializers.CharField(source="get_outcome_display")
    submitted_at = serializers.DateTimeField()
    preview = serializers.SerializerMethodField()

    def get_preview(self, case):
        return _preview(case)

    # No per-case exemption list. It said a third time what the frequency
    # counts say across the set and the case page says in full, and a row of
    # tags under every result crowded the list badly enough to be hard to read.
    # The exemptions are still counted server-side from these same cases.


class CaseInsightsSerializer(serializers.Serializer):
    indexed = serializers.BooleanField()
    similar_cases = SimilarCaseSerializer(many=True)
    exemption_frequencies = serializers.ListField(child=serializers.DictField())


class RequestSuggestionSerializer(serializers.Serializer):
    """One published response offered to someone drafting a request.

    Carries only what the disclosure log list already publishes, and less of it:
    no exemptions. On a staff panel an exemption code is precedent; on a card
    shown to a member of the public mid-request it is jargon attached to a
    result they have not read yet, and it reads as a warning that their own
    request will be refused.

    No score and no ordering claim beyond the order of the list, for the reason
    at the top of this module — more so here, where the reader has no way to
    calibrate a number against anything.
    """

    id = serializers.IntegerField()
    case_ref = serializers.CharField(source="case.ref")
    title = serializers.CharField()
    date_responded = serializers.DateField()
    preview = serializers.SerializerMethodField()

    def get_preview(self, entry):
        # `summary` is the request as published, already reviewed by staff — the
        # same field the disclosure log list shows, cut the same way.
        return _preview_text(entry.summary)
