from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DisclosureLogEntryViewSet, PublicationSchemeEntryViewSet

router = DefaultRouter()
router.register(r"scheme", PublicationSchemeEntryViewSet, basename="scheme")
router.register(r"disclosure-log", DisclosureLogEntryViewSet, basename="disclosure-log")

app_name = "publications"

urlpatterns = [
    path("", include(router.urls)),
]
