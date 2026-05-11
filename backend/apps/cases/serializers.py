from rest_framework import serializers
from .models import Case, CaseConsultation, CaseExemption, Department, CaseNote, CaseAuditEvent, RequesterCategory


class RequesterCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = RequesterCategory
        fields = ['id', 'name', 'order']


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'internal_deadline_days']


class CaseAuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    def get_actor_name(self, obj):
        if not obj.actor:
            return None
        name = f'{obj.actor.first_name} {obj.actor.last_name}'.strip()
        return name or obj.actor.email

    class Meta:
        model = CaseAuditEvent
        fields = ['id', 'action', 'actor_name', 'detail', 'timestamp']


class CaseNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    def get_author_name(self, obj):
        if not obj.author:
            return None
        name = f'{obj.author.first_name} {obj.author.last_name}'.strip()
        return name or obj.author.email

    class Meta:
        model = CaseNote
        fields = ['id', 'body', 'author_name', 'created_at']
        read_only_fields = ['author_name', 'created_at']

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError('Note body cannot be empty.')
        return value


class CaseConsultationSerializer(serializers.ModelSerializer):
    department_name = serializers.SerializerMethodField()
    assignee_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    def get_assignee_name(self, obj):
        if not obj.assignee:
            return None
        name = f'{obj.assignee.first_name} {obj.assignee.last_name}'.strip()
        return name or obj.assignee.email

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        name = f'{obj.created_by.first_name} {obj.created_by.last_name}'.strip()
        return name or obj.created_by.email

    class Meta:
        model = CaseConsultation
        fields = [
            'id', 'department', 'department_name', 'assignee', 'assignee_name',
            'scope', 'status', 'due_date', 'response',
            'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'department_name', 'assignee_name', 'created_by_name']


class CaseListSerializer(serializers.ModelSerializer):
    department_name = serializers.SerializerMethodField()
    assignee_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    def get_department_name(self, obj):
        return obj.department.name if obj.department else None

    def get_assignee_name(self, obj):
        if not obj.assignee:
            return None
        name = f'{obj.assignee.first_name} {obj.assignee.last_name}'.strip()
        return name or obj.assignee.email

    class Meta:
        model = Case
        fields = [
            'id', 'ref', 'status', 'requester_name', 'requester_type',
            'request_text', 'summary', 'department_name', 'assignee_name',
            'submitted_at', 'statutory_deadline', 'is_overdue',
        ]


class CaseDetailSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), source='department', write_only=True, required=False
    )
    assignee_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    notes = CaseNoteSerializer(many=True, read_only=True)
    audit_events = CaseAuditEventSerializer(many=True, read_only=True)
    consultations = CaseConsultationSerializer(many=True, read_only=True)

    def get_assignee_name(self, obj):
        if not obj.assignee:
            return None
        name = f'{obj.assignee.first_name} {obj.assignee.last_name}'.strip()
        return name or obj.assignee.email

    class Meta:
        model = Case
        fields = [
            'id', 'ref', 'status', 'received_by',
            'requester_name', 'requester_email', 'requester_type',
            'preferred_response_format', 'request_text', 'summary',
            'department', 'department_id', 'assignee', 'assignee_name',
            'submitted_at', 'acknowledged_at', 'statutory_deadline',
            'clock_paused', 'clock_paused_days', 'is_overdue',
            'outcome', 'created_at', 'updated_at',
            'notes', 'audit_events', 'consultations',
        ]
        read_only_fields = [
            'ref', 'status', 'acknowledged_at', 'statutory_deadline',
            'clock_paused', 'clock_paused_days', 'created_at', 'updated_at',
        ]


class PublicCaseSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Case
        fields = ['requester_name', 'requester_email', 'request_text']


class PublicCaseTrackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Case
        fields = ['ref', 'status', 'submitted_at', 'statutory_deadline']


class CaseExemptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseExemption
        fields = ['id', 'code', 'notes', 'created_at']
        read_only_fields = ['created_at']


class CaseTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Case.Status.choices)
