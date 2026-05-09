from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import CaseDocumentViewSet

app_name = 'documents'

urlpatterns = [
    path(
        'cases/<int:case_pk>/documents/',
        CaseDocumentViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='case-documents-list',
    ),
    path(
        'cases/<int:case_pk>/documents/<int:pk>/',
        CaseDocumentViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update', 'put': 'update'}),
        name='case-documents-detail',
    ),
]
