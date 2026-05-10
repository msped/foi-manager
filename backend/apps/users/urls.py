from django.urls import path
from rest_framework_simplejwt.views import TokenVerifyView
from dj_rest_auth.jwt_auth import get_refresh_view
from dj_rest_auth.views import LoginView, LogoutView, UserDetailsView
from .views import MicrosoftLogin, UserListView

app_name = 'users'

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='rest_login'),
    path('auth/logout/', LogoutView.as_view(), name='rest_logout'),
    path('auth/user/', UserDetailsView.as_view(), name='rest_user_details'),
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('auth/token/refresh/', get_refresh_view().as_view(), name='token_refresh'),
    path('auth/microsoft/', MicrosoftLogin.as_view(), name='microsoft_login'),
    path('users/', UserListView.as_view(), name='user-list'),
]
