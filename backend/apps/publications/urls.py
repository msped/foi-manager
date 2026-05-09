from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PublicationSchemeEntryViewSet

router = DefaultRouter()
router.register(r'scheme', PublicationSchemeEntryViewSet, basename='scheme')

app_name = 'publications'

urlpatterns = [
    path('', include(router.urls)),
]
