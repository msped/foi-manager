from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CaseViewSet, DepartmentViewSet, PublicCaseSubmitView, PublicCaseTrackView
from .views_notes import CaseNoteViewSet
from .views_exemptions import CaseExemptionViewSet

router = DefaultRouter()
router.register(r'cases', CaseViewSet, basename='case')
router.register(r'departments', DepartmentViewSet, basename='department')

app_name = 'cases'

urlpatterns = [
    path('', include(router.urls)),
    path('public/submit/', PublicCaseSubmitView.as_view(), name='public-submit'),
    path('public/track/', PublicCaseTrackView.as_view(), name='public-track'),
    path(
        'cases/<int:case_pk>/notes/',
        CaseNoteViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='case-notes-list',
    ),
    path(
        'cases/<int:case_pk>/exemptions/',
        CaseExemptionViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='case-exemptions-list',
    ),
    path(
        'cases/<int:case_pk>/exemptions/<int:pk>/',
        CaseExemptionViewSet.as_view({'delete': 'destroy'}),
        name='case-exemptions-detail',
    ),
]
