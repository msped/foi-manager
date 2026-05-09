from rest_framework import serializers
from .models import CaseDocument


class CaseDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.__str__', read_only=True, default=None)

    class Meta:
        model = CaseDocument
        fields = [
            'id', 'file', 'original_filename', 'is_public',
            'uploaded_by_name', 'uploaded_at',
        ]
        read_only_fields = ['uploaded_by_name', 'uploaded_at']
