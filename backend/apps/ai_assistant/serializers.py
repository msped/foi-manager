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


def _preview(case) -> str:
    """Enough of the request to judge a suggestion without opening it."""
    text = (case.summary or case.request_text or "").strip()
    if len(text) <= PREVIEW_LENGTH:
        return text
    return text[:PREVIEW_LENGTH].rsplit(" ", 1)[0] + "…"


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
