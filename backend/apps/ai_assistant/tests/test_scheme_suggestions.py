"""Matching a draft request against the publication scheme.

Keyword-only, so unlike every other retrieval test here none of this depends on
an embedder — which is itself one of the things being asserted.

The gate is the interesting part. Everywhere else in this app relevance is
decided by two independent methods agreeing; the scheme has one method, so it
gates on depth of overlap instead, and the tests that matter are the ones
showing a single shared word is not enough.
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.ai_assistant.embeddings import EmbeddingUnavailable
from apps.ai_assistant.public import suggest_scheme_entries
from apps.publications.models import PublicationSchemeEntry, PublicationSchemeItem

pytestmark = pytest.mark.django_db

#: Deliberately modest vocabulary. Below `MIN_CORPUS_FOR_FREQUENCY` the ranking
#: in `_rank_lexemes` has no frequencies to work with and falls back to the
#: alphabet, so a request with more than `MAX_LEXEMES` content words would have
#: its terms chosen by spelling. Keeping this short means every content word
#: survives and the tests assert on the gate rather than on that fallback.
CROSSINGS = (
    "How much did the council spend on school crossing patrols and lollipop "
    "wardens?"
)


@pytest.fixture
def make_scheme_entry(db):
    def _make(title, description, *, published=True, with_item=True):
        entry = PublicationSchemeEntry.objects.create(
            title=title,
            category=PublicationSchemeEntry.Category.FINANCES,
            description=description,
            status=(
                PublicationSchemeEntry.Status.PUBLISHED
                if published
                else PublicationSchemeEntry.Status.DRAFT
            ),
        )
        if with_item:
            PublicationSchemeItem.objects.create(
                entry=entry,
                kind=PublicationSchemeItem.Kind.LINK,
                label="Details",
                url="https://example.gov.uk/scheme",
            )
        return entry

    return _make


class TestWhatMatches:
    def test_an_entry_sharing_several_terms_is_suggested(self, make_scheme_entry):
        entry = make_scheme_entry(
            "School crossing patrols",
            "Locations of school crossing patrol sites and lollipop wardens.",
        )
        assert [e.pk for e in suggest_scheme_entries(CROSSINGS)] == [entry.pk]

    def test_one_shared_word_is_not_enough(self, make_scheme_entry):
        """The whole gate, in one test. A request about school crossings and an
        entry about school meals share `school` and nothing else that matters;
        offering the second in answer to the first is what a threshold of one
        would do."""
        make_scheme_entry("School meals", "Free school meals uptake.")
        assert suggest_scheme_entries(CROSSINGS) == []

    def test_an_unrelated_entry_is_not_suggested(self, make_scheme_entry):
        make_scheme_entry(
            "Highways maintenance",
            "Pothole repairs and road resurfacing programmes.",
        )
        assert suggest_scheme_entries(CROSSINGS) == []

    def test_drafts_are_never_suggested(self, make_scheme_entry):
        """A draft is not on the public site, so offering it on the request form
        would publish it by a side door."""
        make_scheme_entry(
            "School crossing patrols",
            "Locations of school crossing patrol sites and lollipop wardens.",
            published=False,
        )
        assert suggest_scheme_entries(CROSSINGS) == []

    def test_unpublishing_withdraws_an_entry_from_matching(self, make_scheme_entry):
        entry = make_scheme_entry(
            "School crossing patrols",
            "Locations of school crossing patrol sites and lollipop wardens.",
        )
        assert suggest_scheme_entries(CROSSINGS) != []

        entry.status = PublicationSchemeEntry.Status.DRAFT
        entry.save()
        assert suggest_scheme_entries(CROSSINGS) == []

    def test_results_are_capped(self, make_scheme_entry):
        for n in range(6):
            make_scheme_entry(
                f"School crossing patrols {n}",
                "Locations of school crossing patrol sites and lollipop wardens.",
            )
        assert len(suggest_scheme_entries(CROSSINGS)) == 3


class TestShortText:
    def test_short_text_returns_nothing(self, make_scheme_entry):
        """Too few words to support a two-term gate. Nothing is embedded on this
        path, so this is the length floor doing its first job rather than its
        second."""
        make_scheme_entry("School crossing patrols", "Lollipop wardens.")
        assert suggest_scheme_entries("school crossing") == []

    def test_empty_text_returns_nothing(self, make_scheme_entry):
        make_scheme_entry("School crossing patrols", "Lollipop wardens.")
        assert suggest_scheme_entries("") == []


class TestWithoutTheEmbedder:
    def test_scheme_matching_survives_ollama_being_down(
        self, make_scheme_entry, monkeypatch
    ):
        """The reason this surface is keyword-only rather than a second copy of
        the disclosure log retrieval. Stopping the model takes the published
        responses away and leaves the scheme working."""

        def unavailable(*args, **kwargs):
            raise EmbeddingUnavailable("ollama is not running")

        monkeypatch.setattr(
            "apps.ai_assistant.public.get_embedder", unavailable
        )
        entry = make_scheme_entry(
            "School crossing patrols",
            "Locations of school crossing patrol sites and lollipop wardens.",
        )
        assert [e.pk for e in suggest_scheme_entries(CROSSINGS)] == [entry.pk]


class TestEndpoint:
    def test_response_carries_both_lists(self, make_scheme_entry):
        make_scheme_entry(
            "School crossing patrols",
            "Locations of school crossing patrol sites and lollipop wardens.",
        )
        url = reverse("ai_assistant:public-request-suggestions")
        resp = APIClient().post(url, {"request_text": CROSSINGS}, format="json")

        assert resp.status_code == 200
        assert "suggestions" in resp.data
        assert len(resp.data["scheme_entries"]) == 1

    def test_scheme_entry_carries_its_links(self, make_scheme_entry):
        """The scheme has no per-entry page, so a suggestion without its links
        is a dead end."""
        make_scheme_entry(
            "School crossing patrols",
            "Locations of school crossing patrol sites and lollipop wardens.",
        )
        url = reverse("ai_assistant:public-request-suggestions")
        resp = APIClient().post(url, {"request_text": CROSSINGS}, format="json")

        item = resp.data["scheme_entries"][0]["items"][0]
        assert item["label"] == "Details"
        assert item["url"] == "https://example.gov.uk/scheme"

    def test_anonymous_is_allowed(self, make_scheme_entry):
        url = reverse("ai_assistant:public-request-suggestions")
        resp = APIClient().post(url, {"request_text": CROSSINGS}, format="json")
        assert resp.status_code == 200
