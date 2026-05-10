from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/v1/', include('apps.cases.urls', namespace='cases')),
    path('api/v1/publications/', include('apps.publications.urls', namespace='publications')),
    path('api/v1/', include('apps.documents.urls', namespace='documents')),
    path('api/v1/', include('apps.users.urls', namespace='users')),
]
