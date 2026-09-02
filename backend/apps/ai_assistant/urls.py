from django.urls import path

from .views import CaseInsightsView

app_name = "ai_assistant"

urlpatterns = [
    path(
        "cases/<int:case_id>/insights/",
        CaseInsightsView.as_view(),
        name="case-insights",
    ),
]
