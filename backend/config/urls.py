from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("api/v1/", include("apps.cases.urls", namespace="cases")),
    path(
        "api/v1/publications/",
        include("apps.publications.urls", namespace="publications"),
    ),
    path(
        "api/v1/public/track/",
        include("apps.requester_portal.urls", namespace="requester_portal"),
    ),
    path("api/v1/ai/", include("apps.ai_assistant.urls", namespace="ai_assistant")),
    path("api/v1/", include("apps.documents.urls", namespace="documents")),
    path("api/v1/", include("apps.users.urls", namespace="users")),
]

# Serves uploaded files in development only; static() is a no-op when DEBUG is
# off, where a real web server fronts MEDIA_ROOT instead.
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
