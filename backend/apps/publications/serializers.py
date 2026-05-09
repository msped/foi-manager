from rest_framework import serializers
from .models import PublicationSchemeEntry


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
