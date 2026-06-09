from dj_rest_auth.jwt_auth import get_refresh_view
from dj_rest_auth.views import LoginView, LogoutView, UserDetailsView
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenVerifyView

from .views import (
    MicrosoftLogin,
    NotificationPreferencesView,
    NotificationViewSet,
    UserListView,
    UserSearchView,
    UserUpdateView,
)

app_name = "users"

router = DefaultRouter()
router.register(r"notifications", NotificationViewSet, basename="notification")

urlpatterns = [
    path(
        "notifications/preferences/",
        NotificationPreferencesView.as_view(),
        name="notification-preferences",
    ),
    path("", include(router.urls)),
    path("auth/login/", LoginView.as_view(), name="rest_login"),
    path("auth/logout/", LogoutView.as_view(), name="rest_logout"),
    path("auth/user/", UserDetailsView.as_view(), name="rest_user_details"),
    path("auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("auth/token/refresh/", get_refresh_view().as_view(), name="token_refresh"),
    path("auth/microsoft/", MicrosoftLogin.as_view(), name="microsoft_login"),
    path("users/", UserListView.as_view(), name="user-list"),
    path("users/search/", UserSearchView.as_view(), name="user-search"),
    path("users/<int:pk>/", UserUpdateView.as_view(), name="user-detail"),
]
