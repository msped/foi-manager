from django.contrib.auth import get_user_model
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.cases.permissions import IsFOITeam
from .serializers import EmailTokenObtainSerializer, UserSerializer

User = get_user_model()


class EmailTokenObtainView(TokenObtainPairView):
    serializer_class = EmailTokenObtainSerializer


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsFOITeam]

    def get_queryset(self):
        return User.objects.all().order_by('first_name', 'last_name', 'email')
