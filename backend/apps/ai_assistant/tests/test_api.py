import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.cases.models import CaseExemption

from .conftest import AGENCY, POTHOLES, STAFFING

pytestmark = pytest.mark.django_db


@pytest.fixture
def url():
    def _url(case):
        return reverse("ai_assistant:case-insights", args=[case.pk])

    return _url


@pytest.fixture
def foi_client(foi_team_user):
    client = APIClient()
    client.force_authenticate(user=foi_team_user)
    return client


class TestPermissions:
    def test_anonymous_is_rejected(self, make_case, url):
        assert APIClient().get(url(make_case(AGENCY))).status_code in (401, 403)

    def test_assignee_is_rejected(self, make_case, url, assignee_user):
        """The reason this endpoint is not `IsAuthenticated`.

        The case list is scoped so an assignee sees only their own cases. This
        returns cases chosen by resemblance, so opening it to any authenticated
        user would hand an assignee requester details from cases they were
        never assigned — a way around the scoping rather than a view onto it.
        """
        client = APIClient()
        client.force_authenticate(user=assignee_user)
        assert client.get(url(make_case(AGENCY))).status_code == 403

    def test_foi_team_is_allowed(self, make_case, url, foi_client):
        assert foi_client.get(url(make_case(AGENCY))).status_code == 200

    def test_missing_case_is_404(self, foi_client, db):
        assert (
            foi_client.get(
                reverse("ai_assistant:case-insights", args=[999])
            ).status_code
            == 404
        )


class TestPayload:
    def test_similarity_scores_are_never_exposed(self, make_case, url, foi_client):
        """A number like 0.62 next to a suggestion reads as a measurement of
        relevance. It is not one — the range moves with the model, the prefixes
        and the length of the texts. Rank order says all that can be supported."""
        target = make_case(AGENCY)
        make_case(STAFFING, email="b@example.com")

        body = foi_client.get(url(target)).content.decode()
        assert "distance" not in body
        assert "score" not in body

    def test_similar_cases_are_returned_in_rank_order(self, make_case, url, foi_client):
        target = make_case(AGENCY)
        make_case(POTHOLES, email="b@example.com")
        related = make_case(STAFFING, email="c@example.com")

        data = foi_client.get(url(target)).data
        assert data["similar_cases"][0]["ref"] == related.ref

    def test_case_preview_is_included(self, make_case, url, foi_client):
        target = make_case(AGENCY)
        make_case(STAFFING, email="b@example.com")

        first = foi_client.get(url(target)).data["similar_cases"][0]
        assert "agency staff" in first["preview"]

    def test_exemption_frequencies_are_counts(self, make_case, url, foi_client):
        target = make_case(AGENCY)
        neighbour = make_case(STAFFING, email="b@example.com")
        CaseExemption.objects.create(
            case=neighbour, code=CaseExemption.Code.S43_COMMERCIAL
        )

        freqs = foi_client.get(url(target)).data["exemption_frequencies"]
        assert freqs[0]["code"] == "s43"
        assert freqs[0]["count"] == 1
        assert freqs[0]["case_count"] == 1

    def test_each_case_appears_once_in_one_list(self, make_case, url, foi_client):
        """A similar case is rendered once. Earlier versions carried a second
        list of the same cases, keyed on the requester and the s.12(4) window."""
        case = make_case(AGENCY, email="same@example.com")
        other = make_case(STAFFING, email="same@example.com", days_ago=3)

        data = foi_client.get(url(case)).data
        assert "related_requests" not in data
        assert [r["ref"] for r in data["similar_cases"]] == [other.ref]

    def test_no_requester_details_are_returned(self, make_case, url, foi_client):
        """This is the one endpoint that returns records the caller was not
        assigned — selected by resemblance rather than by assignment. It carries
        the request and its outcome, and nothing about who sent it."""
        case = make_case(AGENCY, email="one@example.com")
        make_case(STAFFING, email="two@example.com", days_ago=3)

        resp = foi_client.get(url(case))
        body = resp.content.decode()
        assert "two@example.com" not in body

        [row] = resp.data["similar_cases"]
        assert "same_requester" not in row
        assert "requester_email" not in row
        assert "requester_name" not in row

    def test_no_date_bounded_fields_are_returned(self, make_case, url, foi_client):
        """Retrieval is unbounded in time, and the payload should not suggest
        otherwise — a badge implying a window was read as one."""
        case = make_case(AGENCY, email="one@example.com")
        make_case(STAFFING, email="two@example.com", days_ago=1200)

        data = foi_client.get(url(case)).data
        assert "window_working_days" not in data

        [row] = data["similar_cases"]
        assert "within_aggregation_window" not in row
        assert "working_days_apart" not in row

    @override_settings(AI_MAX_DISTANCE=0.05)
    def test_an_irrelevant_corpus_produces_an_empty_panel(
        self, make_case, url, foi_client
    ):
        """The reported problem: a case about one thing was being answered with
        whatever else existed, because k-nearest returns k rows however far
        away they are."""
        target = make_case(AGENCY)
        make_case(POTHOLES, email="b@example.com")

        data = foi_client.get(url(target)).data
        assert data["indexed"] is True
        assert data["similar_cases"] == []
        assert data["exemption_frequencies"] == []

    def test_unindexed_case_returns_an_empty_panel_not_an_error(
        self, db, url, foi_client, make_case
    ):
        from apps.cases.models import Case

        make_case(STAFFING)
        fresh = Case.objects.create(
            requester_name="A", requester_email="a@example.com", request_text=AGENCY
        )

        resp = foi_client.get(url(fresh))
        assert resp.status_code == 200
        assert resp.data["indexed"] is False
        assert resp.data["similar_cases"] == []

    def test_publication_makes_no_difference(
        self, make_case, make_entry, url, foi_client
    ):
        """Publication is decided after a response is sent and says nothing
        about how the request was handled, so a published case and an
        unpublished one are the same kind of precedent and appear identically.
        """
        published = make_case(AGENCY, email="old@example.com")
        make_entry(published, "Agency staff spend 2023/24", AGENCY)
        unpublished = make_case(AGENCY, email="other@example.com")

        target = make_case(STAFFING, email="new@example.com")
        data = foi_client.get(url(target)).data

        assert "similar_published_entries" not in data
        refs = {row["ref"] for row in data["similar_cases"]}
        assert refs == {published.ref, unpublished.ref}
        for row in data["similar_cases"]:
            assert "has_published_response" not in row
