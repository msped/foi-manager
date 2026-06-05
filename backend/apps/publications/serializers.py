from rest_framework import serializers

from apps.cases.models import Case, CaseExemption, CaseResponse
from apps.documents.models import CaseDocument
from .models import DisclosureLogEntry, PublicationSchemeEntry


class PublicationSchemeEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicationSchemeEntry
        fields = [
            'id', 'title', 'category', 'description',
            'url', 'document', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class CaseExemptionBriefSerializer(serializers.ModelSerializer):
    code_display = serializers.CharField(source='get_code_display', read_only=True)

    class Meta:
        model = CaseExemption
        fields = ['id', 'code', 'code_display']


class CaseDocumentBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseDocument
        fields = ['id', 'original_filename', 'is_public']


class QueueDisclosureLogEntrySerializer(serializers.ModelSerializer):
    exemptions = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    attachments = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = DisclosureLogEntry
        fields = [
            'id', 'title', 'summary', 'response_text',
            'date_received', 'date_responded',
            'exemptions', 'attachments',
            'is_published', 'published_at',
        ]


class PublishQueueItemSerializer(serializers.ModelSerializer):
    sent_response = serializers.SerializerMethodField()
    exemptions = CaseExemptionBriefSerializer(many=True, read_only=True)
    documents = CaseDocumentBriefSerializer(many=True, read_only=True)
    disclosure_log_entry = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = [
            'id', 'ref', 'summary', 'request_text', 'submitted_at',
            'sent_response', 'exemptions', 'documents', 'disclosure_log_entry',
        ]

    def get_sent_response(self, case):
        for r in case.responses.all():
            if r.status == CaseResponse.Status.SENT:
                return {
                    'id': r.id,
                    'rendered_body': r.rendered_body,
                    'sent_at': r.sent_at.isoformat() if r.sent_at else None,
                }
        return None

    def get_disclosure_log_entry(self, case):
        try:
            return QueueDisclosureLogEntrySerializer(case.disclosure_log_entry).data
        except Exception:
            return None


class DisclosureLogEntrySerializer(serializers.ModelSerializer):
    exemptions = serializers.PrimaryKeyRelatedField(
        many=True, queryset=CaseExemption.objects.all()
    )
    attachments = serializers.PrimaryKeyRelatedField(
        many=True, queryset=CaseDocument.objects.all()
    )
    case_ref = serializers.CharField(source='case.ref', read_only=True)
    published_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DisclosureLogEntry
        fields = [
            'id', 'case', 'case_ref',
            'title', 'summary', 'response_text',
            'date_received', 'date_responded',
            'exemptions', 'attachments',
            'is_published', 'published_by', 'published_by_name', 'published_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'case_ref', 'is_published', 'published_by', 'published_by_name',
            'published_at', 'created_at', 'updated_at',
        ]

    def get_published_by_name(self, obj):
        return obj.published_by.get_full_name() if obj.published_by else None

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret['exemptions_detail'] = [
            {'id': e.id, 'code': e.code, 'code_display': e.get_code_display()}
            for e in instance.exemptions.all()
        ]
        ret['attachments_detail'] = [
            {'id': a.id, 'original_filename': a.original_filename, 'is_public': a.is_public}
            for a in instance.attachments.all()
        ]
        return ret

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
