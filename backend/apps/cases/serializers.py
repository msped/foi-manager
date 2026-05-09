from rest_framework import serializers
from .models import Case, Department, CaseNote, CaseAuditEvent


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'internal_deadline_days']


class CaseAuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.__str__', read_only=True, default=None)

    class Meta:
        model = CaseAuditEvent
        fields = ['id', 'action', 'actor_name', 'detail', 'timestamp']


class CaseNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.__str__', read_only=True, default=None)

    class Meta:
        model = CaseNote
        fields = ['id', 'body', 'author_name', 'created_at']
        read_only_fields = ['author_name', 'created_at']


class CaseListSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)
    assignee_name = serializers.CharField(source='assignee.__str__', read_only=True, default=None)
    is_overdue = serializers.BooleanField(read_only=True)

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
    assignee_name = serializers.CharField(source='assignee.__str__', read_only=True, default=None)
    is_overdue = serializers.BooleanField(read_only=True)
    notes = CaseNoteSerializer(many=True, read_only=True)
    audit_events = CaseAuditEventSerializer(many=True, read_only=True)

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
            'notes', 'audit_events',
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


class CaseTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Case.Status.choices)
