from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CaseViewSet, DepartmentViewSet, PublicCaseSubmitView, PublicCaseTrackView

router = DefaultRouter()
router.register(r'cases', CaseViewSet, basename='case')
router.register(r'departments', DepartmentViewSet, basename='department')

app_name = 'cases'

urlpatterns = [
    path('', include(router.urls)),
    path('public/submit/', PublicCaseSubmitView.as_view(), name='public-submit'),
    path('public/track/', PublicCaseTrackView.as_view(), name='public-track'),
]
