from django.urls import path

from .views import CaseInsightsView, RequestSuggestionsView

app_name = "ai_assistant"

urlpatterns = [
    path(
        "cases/<int:case_id>/insights/",
        CaseInsightsView.as_view(),
        name="case-insights",
    ),
    # Under `public/` so the auth boundary shows up in the route table as well
    # as in the view. Everything else under `ai/` is FOI team only.
    path(
        "public/request-suggestions/",
        RequestSuggestionsView.as_view(),
        name="public-request-suggestions",
    ),
]
