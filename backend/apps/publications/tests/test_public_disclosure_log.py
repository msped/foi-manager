"""The public disclosure log, and specifically how much of a request it sends.

`DisclosureLogEntry.summary` is not a summary in the sense the field name
suggests. The publish queue seeds it from the case's full request text and staff
edit it in place before publishing, so it is routinely a whole FOI request —
several hundred words. Ten of those on one page is what these tests are about.
"""

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.cases.models import Case
from apps.publications.models import DisclosureLogEntry
from apps.publications.serializers import SUMMARY_EXCERPT_CHARS

pytestmark = pytest.mark.django_db

LONG_REQUEST = (
    "Please provide the total amount spent on agency and temporary staff. " * 40
).strip()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def published(db, foi_team_user):
    case = Case.objects.create(
        requester_name="A Requester",
        requester_email="requester@example.com",
        request_text=LONG_REQUEST,
    )
    return DisclosureLogEntry.objects.create(
        case=case,
        title="Agency staff spend 2023/24",
        summary=LONG_REQUEST,
        response_text="<p>We spent £1.2m.</p>",
        date_responded=timezone.localdate(),
        status=DisclosureLogEntry.Status.PUBLISHED,
        created_by=foi_team_user,
    )


def list_url():
    return reverse("publications:public-disclosure-log-list")


def detail_url(entry):
    return reverse("publications:public-disclosure-log-detail", args=[entry.pk])


class TestListExcerpt:
    def test_a_long_request_is_cut(self, api_client, published):
        [row] = api_client.get(list_url()).data["results"]

        assert len(row["summary"]) < len(LONG_REQUEST)
        assert row["summary"].endswith("…")
        # The ellipsis is added after the cut, so the excerpt is at most one
        # character longer than the budget.
        assert len(row["summary"]) <= SUMMARY_EXCERPT_CHARS + 1

    def test_it_is_cut_at_a_word_boundary(self, api_client, published):
        [row] = api_client.get(list_url()).data["results"]

        assert LONG_REQUEST.startswith(row["summary"].removesuffix("…").strip())

    def test_a_short_request_is_untouched(self, api_client, published):
        published.summary = "How many potholes were repaired last year?"
        published.save()

        [row] = api_client.get(list_url()).data["results"]
        assert row["summary"] == "How many potholes were repaired last year?"
        assert "…" not in row["summary"]


class TestDetailIsWhole:
    def test_the_detail_page_keeps_the_full_request(self, api_client, published):
        """The detail serializer inherits the list serializer's field list, and
        inheriting the excerpt with it would leave the full request published
        nowhere. This is the page someone opens because they want to read it."""
        data = api_client.get(detail_url(published)).data

        assert data["summary"] == LONG_REQUEST
        assert not data["summary"].endswith("…")


class TestSearchStillSeesTheWholeRequest:
    def test_a_term_past_the_excerpt_still_matches(self, api_client, published):
        """Truncation is a display concern. The filter runs against the stored
        column, so a word only appearing late in a long request must still find
        it — the result's excerpt simply will not show the term."""
        published.summary = ("padding word " * 60) + "kingfisher"
        published.save()

        results = api_client.get(list_url(), {"search": "kingfisher"}).data["results"]
        assert [r["id"] for r in results] == [published.pk]
        assert "kingfisher" not in results[0]["summary"]
