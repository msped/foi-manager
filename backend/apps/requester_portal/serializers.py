from rest_framework import serializers

from apps.cases.models import Case

#: What each internal status is called on the public tracking page.
#:
#: A translation table, not a display helper, and it lives here rather than on
#: Case because it is portal presentation and not casework. The internal
#: vocabulary is office shorthand — "Drafting", "With Department", "Referred" —
#: which tells a requester nothing they can act on and describes how the team is
#: organised, so the public page never renders `get_status_display()`. Several
#: internal statuses deliberately collapse onto a single public phrase.
PUBLIC_STATUS_LABELS = {
    Case.Status.NEW: "Received",
    Case.Status.ACKNOWLEDGED: "Being processed",
    Case.Status.WITH_DEPARTMENT: "Being processed",
    Case.Status.DRAFTING: "Being processed",
    Case.Status.REVIEW: "Being processed",
    # The most useful sentence on the page: we are waiting on them, and their
    # clock is not running until they reply.
    Case.Status.WITH_APPLICANT: "Awaiting your response",
    Case.Status.INTERNAL_REVIEW: "Internal review",
    # Case.Status.REFERRED means the Information Commissioner, not the NPCC
    # Central Referral Unit — CaseCRUAdvice tracks that, and it is never public.
    Case.Status.REFERRED: "With the Information Commissioner",
    Case.Status.EXEMPT: "Closed",
    Case.Status.CLOSED: "Closed",
}

#: Shown for a status missing from the map, which can only happen if someone
#: adds a Case.Status without adding it above. Vague on purpose: the failure
#: mode of a public page is to say too much, so the fallback says almost
#: nothing rather than guessing.
DEFAULT_PUBLIC_STATUS = "Being processed"


class PublicTrackedCaseSerializer(serializers.ModelSerializer):
    """A requester's own case, as shown on the public tracking page.

    Every field here is either something the requester wrote themselves or
    something we have already told them. Note what is absent: the response body.
    Responses routinely contain third-party personal data cleared for one named
    recipient, and access here is by email alone — a shared mailbox verifies
    once and lists every request sent from it, which would pool other people's
    disclosures behind a single code. Where a response has been through
    publication review, `disclosure_log_id` points at that public version
    instead.
    """

    status = serializers.SerializerMethodField()
    outcome = serializers.SerializerMethodField()
    statutory_deadline = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    disclosure_log_id = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = [
            "ref",
            "request_text",
            "status",
            "outcome",
            "submitted_at",
            "statutory_deadline",
            "clock_paused",
            "is_overdue",
            "disclosure_log_id",
        ]

    def get_status(self, obj) -> str:
        return PUBLIC_STATUS_LABELS.get(obj.status, DEFAULT_PUBLIC_STATUS)

    def get_outcome(self, obj) -> str:
        return obj.get_outcome_display() if obj.outcome else ""

    def get_statutory_deadline(self, obj):
        # Withheld while the clock is paused. `statutory_deadline` is only
        # brought back up to date by resume_clock(), so mid-pause the stored
        # value is a date we already know to be wrong — publishing it would
        # promise the requester a reply on a day we do not intend to reply.
        if obj.clock_paused:
            return None
        return obj.statutory_deadline

    def get_is_overdue(self, obj) -> bool:
        # Stated plainly rather than hidden; the portal pairs it with the
        # complaint route. Suppressed while paused, for the same reason as the
        # deadline itself.
        if obj.clock_paused:
            return False
        return obj.is_overdue

    def get_disclosure_log_id(self, obj):
        entry = getattr(obj, "disclosure_log_entry", None)
        if entry and entry.status == entry.Status.PUBLISHED:
            return entry.pk
        return None


class RequesterCodeRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class RequesterCodeVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
