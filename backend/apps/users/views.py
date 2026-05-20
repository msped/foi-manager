from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import generics, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from allauth.socialaccount.providers.microsoft.views import MicrosoftGraphOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

from apps.cases.permissions import IsFOITeam
from .models import Notification
from .serializers import NotificationSerializer, UserSearchSerializer, UserSerializer

User = get_user_model()


class MicrosoftLogin(SocialLoginView):
    adapter_class = MicrosoftGraphOAuth2Adapter
    client_class = OAuth2Client

    @property
    def callback_url(self):
        return f"{settings.FRONTEND_URL}/api/auth/callback/microsoft-entra-id"


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsFOITeam]
    pagination_class = None

    def get_queryset(self):
        return User.objects.all().order_by('first_name', 'last_name', 'email')


class UserUpdateView(generics.UpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsFOITeam]
    http_method_names = ['patch']

    def get_queryset(self):
        return User.objects.all()


class UserSearchView(generics.ListAPIView):
    serializer_class = UserSearchSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        search = self.request.query_params.get('search', '').strip()
        qs = User.objects.filter(is_active=True)
        if search:
            qs = qs.filter(
                first_name__icontains=search
            ) | User.objects.filter(
                is_active=True, last_name__icontains=search
            ) | User.objects.filter(
                is_active=True, email__icontains=search
            )
        return qs.distinct().order_by('first_name', 'last_name')


class NotificationViewSet(
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response({'detail': 'All notifications marked as read.'})

    @action(detail=True, methods=['patch'])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.read = True
        notification.save(update_fields=['read'])
        return Response(NotificationSerializer(notification).data)
