from rest_framework import serializers

from .models import (
    BankHoliday,
    Case,
    CaseAuditEvent,
    CaseConsultation,
    CaseExemption,
    CaseNote,
    CaseResponse,
    ConsultationMessage,
    Department,
    EmailTemplate,
    Mailbox,
    RequesterCategory,
)


class RequesterCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RequesterCategory
        fields = ["id", "name", "order"]


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "internal_deadline_days"]


class MailboxSerializer(serializers.ModelSerializer):
    class Meta:
        model = Mailbox
        fields = ["id", "name", "email"]


class EmailTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailTemplate
        fields = [
            "id",
            "purpose",
            "name",
            "type",
            "description",
            "subject",
            "body",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["type", "created_at", "updated_at"]

    def validate_purpose(self, value):
        if self.instance and self.instance.purpose != value:
            raise serializers.ValidationError(
                "Purpose cannot be changed after creation."
            )
        return value


class CaseAuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    def get_actor_name(self, obj):
        if not obj.actor:
            return None
        name = f"{obj.actor.first_name} {obj.actor.last_name}".strip()
        return name or obj.actor.email

    class Meta:
        model = CaseAuditEvent
        fields = ["id", "action", "actor_name", "detail", "timestamp"]


class CaseNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    def get_author_name(self, obj):
        if not obj.author:
            return None
        name = f"{obj.author.first_name} {obj.author.last_name}".strip()
        return name or obj.author.email

    class Meta:
        model = CaseNote
        fields = ["id", "body", "author_name", "created_at"]
        read_only_fields = ["author_name", "created_at"]

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError("Note body cannot be empty.")
        return value


class ConsultationMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    author_role = serializers.SerializerMethodField()

    def get_author_name(self, obj):
        if not obj.author:
            return None
        name = f"{obj.author.first_name} {obj.author.last_name}".strip()
        return name or obj.author.email

    def get_author_role(self, obj):
        if not obj.author:
            return None
        return obj.author.role

    class Meta:
        model = ConsultationMessage
        fields = ["id", "author_name", "author_role", "body", "created_at"]
        read_only_fields = ["author_name", "author_role", "created_at"]


class CaseConsultationSerializer(serializers.ModelSerializer):
    assignee_name = serializers.SerializerMethodField()
    mailbox_name = serializers.SerializerMethodField()
    mailbox_email = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    messages = ConsultationMessageSerializer(many=True, read_only=True)

    def get_assignee_name(self, obj):
        if not obj.assignee:
            return None
        name = f"{obj.assignee.first_name} {obj.assignee.last_name}".strip()
        return name or obj.assignee.email

    def get_mailbox_name(self, obj):
        return obj.mailbox.name if obj.mailbox else None

    def get_mailbox_email(self, obj):
        return obj.mailbox.email if obj.mailbox else None

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return name or obj.created_by.email

    def validate(self, attrs):
        if self.instance:
            return attrs
        if attrs.get("assignee") and attrs.get("mailbox"):
            raise serializers.ValidationError(
                "A consultation can have an assignee or a mailbox, not both."
            )
        if not attrs.get("assignee") and not attrs.get("mailbox"):
            raise serializers.ValidationError(
                "A consultation must have either an assignee or a mailbox."
            )
        return attrs

    class Meta:
        model = CaseConsultation
        fields = [
            "id",
            "assignee",
            "assignee_name",
            "mailbox",
            "mailbox_name",
            "mailbox_email",
            "scope",
            "status",
            "due_date",
            "created_by_name",
            "created_at",
            "updated_at",
            "messages",
        ]
        read_only_fields = [
            "created_at",
            "updated_at",
            "assignee_name",
            "mailbox_name",
            "mailbox_email",
            "created_by_name",
        ]


class AssigneeConsultationSerializer(serializers.ModelSerializer):
    """Read-only serializer for the assignee's view of their consultations."""

    case_ref = serializers.CharField(source="case.ref", read_only=True)
    case_request_text = serializers.CharField(
        source="case.request_text", read_only=True
    )
    messages = ConsultationMessageSerializer(many=True, read_only=True)

    class Meta:
        model = CaseConsultation
        fields = [
            "id",
            "case_ref",
            "case_request_text",
            "scope",
            "status",
            "created_at",
            "messages",
        ]
        read_only_fields = fields


class CaseResponseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return name or obj.created_by.email

    class Meta:
        model = CaseResponse
        fields = [
            "id",
            "body",
            "status",
            "sent_at",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "sent_at",
            "created_by_name",
            "created_at",
            "updated_at",
        ]


class CaseListSerializer(serializers.ModelSerializer):
    is_overdue = serializers.BooleanField(read_only=True)
    assignee_name = serializers.SerializerMethodField()

    def get_assignee_name(self, obj):
        if not obj.assignee:
            return None
        name = f"{obj.assignee.first_name} {obj.assignee.last_name}".strip()
        return name or obj.assignee.email

    class Meta:
        model = Case
        fields = [
            "id",
            "ref",
            "status",
            "requester_name",
            "requester_type",
            "request_text",
            "summary",
            "submitted_at",
            "statutory_deadline",
            "is_overdue",
            "assignee",
            "assignee_name",
        ]


class CaseDetailSerializer(serializers.ModelSerializer):
    is_overdue = serializers.BooleanField(read_only=True)
    assignee_name = serializers.SerializerMethodField()
    notes = CaseNoteSerializer(many=True, read_only=True)
    audit_events = CaseAuditEventSerializer(many=True, read_only=True)
    consultations = CaseConsultationSerializer(many=True, read_only=True)
    responses = CaseResponseSerializer(many=True, read_only=True)
    disclosure_log_entry = serializers.SerializerMethodField()

    def get_assignee_name(self, obj):
        if not obj.assignee:
            return None
        name = f"{obj.assignee.first_name} {obj.assignee.last_name}".strip()
        return name or obj.assignee.email

    def get_disclosure_log_entry(self, obj):
        try:
            entry = obj.disclosure_log_entry
            return {
                "id": entry.id,
                "status": entry.status,
                "title": entry.title,
                "rejection_reason": entry.rejection_reason,
                "published_at": entry.published_at.isoformat()
                if entry.published_at
                else None,
                "published_by_name": entry.published_by.get_full_name()
                if entry.published_by
                else None,
                "rejected_at": entry.rejected_at.isoformat()
                if entry.rejected_at
                else None,
                "rejected_by_name": entry.rejected_by.get_full_name()
                if entry.rejected_by
                else None,
            }
        except Exception:
            return None

    def validate_assignee(self, value):
        if value is not None and not value.is_foi_team():
            raise serializers.ValidationError(
                "Assignee must be a member of the FOI team."
            )
        return value

    class Meta:
        model = Case
        fields = [
            "id",
            "ref",
            "status",
            "received_by",
            "requester_name",
            "requester_email",
            "requester_type",
            "preferred_response_format",
            "request_text",
            "summary",
            "submitted_at",
            "acknowledged_at",
            "statutory_deadline",
            "clock_paused",
            "clock_paused_days",
            "is_overdue",
            "outcome",
            "created_at",
            "updated_at",
            "assignee",
            "assignee_name",
            "notes",
            "audit_events",
            "consultations",
            "responses",
            "disclosure_log_entry",
        ]
        read_only_fields = [
            "ref",
            "status",
            "acknowledged_at",
            "statutory_deadline",
            "clock_paused",
            "clock_paused_days",
            "created_at",
            "updated_at",
            "assignee_name",
            "disclosure_log_entry",
        ]


class PublicCaseSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Case
        fields = ["requester_name", "requester_email", "request_text"]


class PublicCaseTrackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Case
        fields = ["ref", "status", "submitted_at", "statutory_deadline"]


class CaseExemptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseExemption
        fields = ["id", "code", "notes", "created_at"]
        read_only_fields = ["created_at"]


class BankHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = BankHoliday
        fields = ["id", "country", "name", "date"]


class CaseTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Case.Status.choices)
