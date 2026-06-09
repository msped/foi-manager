from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Notification, NotificationPreferences

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "department",
            "is_active",
        ]
        read_only_fields = ["id", "email"]


class UserSearchSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        name = f"{obj.first_name} {obj.last_name}".strip()
        return name or obj.email

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "link", "read", "created_at"]
        read_only_fields = ["message", "link", "created_at"]


class NotificationPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreferences
        fields = ["notify_on_case_assignment"]
