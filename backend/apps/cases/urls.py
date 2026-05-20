from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BankHolidayViewSet, CaseViewSet, DepartmentViewSet, EmailTemplateViewSet,
    MailboxViewSet, PublicCaseSubmitView, PublicCaseTrackView, RequesterCategoryViewSet,
)
from .views_notes import CaseNoteViewSet
from .views_exemptions import CaseExemptionViewSet
from .views_consultations import CaseConsultationViewSet, ConsultationMessageViewSet
from .views_responses import CaseResponseViewSet

router = DefaultRouter()
router.register(r'cases', CaseViewSet, basename='case')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'requester-categories', RequesterCategoryViewSet, basename='requester-category')
router.register(r'bank-holidays', BankHolidayViewSet, basename='bank-holiday')
router.register(r'mailboxes', MailboxViewSet, basename='mailbox')
router.register(r'email-templates', EmailTemplateViewSet, basename='email-template')

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
    path(
        'cases/<int:case_pk>/consultations/',
        CaseConsultationViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='case-consultations-list',
    ),
    path(
        'cases/<int:case_pk>/consultations/<int:pk>/',
        CaseConsultationViewSet.as_view({'patch': 'partial_update', 'delete': 'destroy'}),
        name='case-consultations-detail',
    ),
    path(
        'consultations/<int:consultation_pk>/messages/',
        ConsultationMessageViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='consultation-messages-list',
    ),
    path(
        'cases/<int:case_pk>/responses/',
        CaseResponseViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='case-responses-list',
    ),
    path(
        'cases/<int:case_pk>/responses/<int:pk>/',
        CaseResponseViewSet.as_view({'patch': 'partial_update'}),
        name='case-responses-detail',
    ),
    path(
        'cases/<int:case_pk>/responses/<int:pk>/send/',
        CaseResponseViewSet.as_view({'post': 'send'}),
        name='case-responses-send',
    ),
]
