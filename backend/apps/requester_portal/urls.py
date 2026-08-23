from django.urls import path

from .views import RequestCodeView, TrackedCasesView, VerifyCodeView

app_name = "requester_portal"

urlpatterns = [
    path("request-code/", RequestCodeView.as_view(), name="request-code"),
    path("verify/", VerifyCodeView.as_view(), name="verify"),
    path("requests/", TrackedCasesView.as_view(), name="requests"),
]
