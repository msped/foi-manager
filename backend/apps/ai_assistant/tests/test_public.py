"""The public request-form surface.

Two things are being defended here and they pull in opposite directions. The
endpoint must be reachable with no credentials at all, and it must never return
anything the disclosure log does not already publish. Most of these tests are
about the second.
"""

import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.ai_assistant.public import MIN_QUERY_CHARS
from apps.cases.submissions import MAX_REQUEST_CHARS
from apps.publications.models import DisclosureLogEntry

from .conftest import AGENCY, POTHOLES, STAFFING

pytestmark = pytest.mark.django_db


@pytest.fixture
def url():
    return reverse("ai_assistant:public-request-suggestions")


@pytest.fixture
def client():
    return APIClient()


def suggest(client, url, text):
    return client.post(url, {"request_text": text}, format="json")


class TestAccess:
    def test_anonymous_is_allowed(self, client, url):
        assert suggest(client, url, AGENCY).status_code == 200

    def test_a_stale_staff_token_does_not_break_the_page(self, client, url, db):
        """`authentication_classes` is emptied for this. A signed-in officer
        whose JWT has expired must still get suggestions on the public portal,
        not a 401 rendered into the middle of a request form."""
        client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
        assert suggest(client, url, AGENCY).status_code == 200

    def test_get_is_not_allowed(self, client, url):
        """POST is the contract — the request text must not reach a query
        string, an access log or a referrer header."""
        assert client.get(url).status_code == 405


class TestWhatIsReturned:
    def test_a_published_entry_answering_the_request_is_suggested(
        self, client, url, make_case, make_entry
    ):
        case = make_case(AGENCY)
        entry = make_entry(case, "Agency staff spend 2023/24", AGENCY)

        data = suggest(client, url, STAFFING).data
        assert [s["id"] for s in data["suggestions"]] == [entry.pk]

    def test_an_unrelated_corpus_suggests_nothing(
        self, client, url, make_case, make_entry
    ):
        """The agreement gate is the whole reason this is shown to the public.
        Someone asking a novel question should be sent on to the form, not
        handed the closest thing that happens to exist."""
        make_entry(make_case(POTHOLES), "Potholes repaired", POTHOLES)

        assert suggest(client, url, AGENCY).data["suggestions"] == []

    def test_unpublished_entries_are_never_suggested(
        self, client, url, make_case, make_entry
    ):
        """The bug this exists to stop.

        `embed_disclosure_entry` returns early for anything not published, so
        unpublishing leaves the vector row behind, and `stale_entry_ids` only
        sweeps published entries so nothing cleans it up. Without the status
        join on the vector arm, a response withdrawn from the disclosure log
        keeps being recommended to the public by title, reference and date.
        """
        case = make_case(AGENCY)
        entry = make_entry(case, "Agency staff spend 2023/24", AGENCY)

        # Indexed while published, then withdrawn — exactly what `unpublish` does.
        entry.status = DisclosureLogEntry.Status.DRAFT
        entry.save()
        assert entry.embedding is not None, "the stale vector should still exist"

        assert suggest(client, url, STAFFING).data["suggestions"] == []

    def test_no_case_internals_are_exposed(self, client, url, make_case, make_entry):
        """This is an anonymous endpoint over records derived from cases. It may
        carry only what `/disclosure-log` already publishes."""
        case = make_case(AGENCY, email="requester@example.com")
        make_entry(case, "Agency staff spend 2023/24", AGENCY)

        body = suggest(client, url, STAFFING).content.decode()
        assert "requester@example.com" not in body
        assert "A Requester" not in body

        [row] = suggest(client, url, STAFFING).data["suggestions"]
        assert set(row) == {"id", "case_ref", "title", "date_responded", "preview"}

    def test_no_similarity_scores(self, client, url, make_case, make_entry):
        make_entry(make_case(AGENCY), "Agency staff spend 2023/24", AGENCY)

        body = suggest(client, url, STAFFING).content.decode()
        assert "distance" not in body
        assert "score" not in body

    @override_settings(AI_PUBLIC_RESULT_COUNT=1)
    def test_the_result_count_is_capped(self, client, url, make_case, make_entry):
        make_entry(make_case(AGENCY), "Agency staff spend", AGENCY)
        make_entry(
            make_case(STAFFING, email="b@example.com"), "Staffing costs", STAFFING
        )

        assert len(suggest(client, url, AGENCY).data["suggestions"]) == 1


class TestInputBounds:
    def test_a_short_query_returns_nothing_rather_than_erroring(
        self, client, url, make_case, make_entry
    ):
        """`nomic-embed-text` returns byte-identical vectors for very short
        inputs on Ollama's CPU backend, which is what production runs. A short
        query must therefore be declined before it is embedded — silently, since
        this fires while someone is still typing."""
        make_entry(make_case(AGENCY), "Agency staff spend 2023/24", AGENCY)

        short = "agency staff"
        assert len(short) < MIN_QUERY_CHARS
        resp = suggest(client, url, short)
        assert resp.status_code == 200
        assert resp.data["suggestions"] == []

    def test_an_oversized_request_is_refused(self, client, url):
        resp = suggest(client, url, "a" * (MAX_REQUEST_CHARS + 1))
        assert resp.status_code == 400

    def test_missing_text_is_not_an_error(self, client, url):
        """The form can call this before anything has been typed."""
        resp = client.post(url, {}, format="json")
        assert resp.status_code == 200
        assert resp.data["suggestions"] == []
