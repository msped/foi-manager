from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from allauth.socialaccount.providers.microsoft.views import MicrosoftGraphOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

from apps.cases.permissions import IsFOITeam
from .serializers import UserSerializer

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

    def get_queryset(self):
        return User.objects.all().order_by('first_name', 'last_name', 'email')
