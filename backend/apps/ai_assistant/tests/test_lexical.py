"""The lexical arm's text entry point.

`case_lexemes` reads a stored `search_vector` back out of a row. Neither public
surface has one — on the request form the case does not exist yet, and a search
box never becomes a row at all — so `text_lexemes` builds the vector on the fly.

What matters is that it agrees with `case_lexemes`. If the two disagreed, the
public side would be matching one stemmer's output against another's, and the
agreement gate would be comparing things that were never comparable.
"""

import pytest

from apps.ai_assistant import lexical

from .conftest import AGENCY, POTHOLES

pytestmark = pytest.mark.django_db


class TestTextLexemes:
    def test_it_agrees_with_the_stored_column(self, make_case):
        """The property the public arm depends on. Same text, same terms,
        whether Postgres generated the vector on write or on the fly."""
        case = make_case(AGENCY)

        from_row = lexical.case_lexemes(case)
        from_text = lexical.text_lexemes(case.request_text, table="cases_case")

        assert from_text == from_row

    def test_terms_are_stemmed_not_taken_raw(self, make_case):
        """Built by `to_tsvector`, so a query term arrives in the same form as
        the documents it will be matched against. Stemming in Python instead
        would be a second implementation of Postgres's English parser."""
        terms = lexical.text_lexemes(
            "How many pothole repairs were completed?", table="cases_case"
        )
        assert "pothole" in terms
        assert "repairs" not in terms

    def test_request_mechanics_are_dropped(self):
        """The words describing the envelope rather than the subject. Without
        this, every request matches every other on 'please email a spreadsheet
        for the last twelve months'."""
        terms = lexical.text_lexemes(
            "Please email a spreadsheet of dog attacks in the last twelve months",
            table="cases_case",
        )
        assert "dog" in terms
        assert "email" not in terms
        assert "spreadsheet" not in terms
        assert "twelv" not in terms
        assert "month" not in terms

    def test_empty_text_asks_nothing(self):
        assert lexical.text_lexemes("   ", table="cases_case") == []

    def test_no_row_is_needed(self, db):
        """The whole point: this runs before anything has been saved."""
        assert "pothole" in lexical.text_lexemes(
            "How many potholes were repaired?", table="cases_case"
        )


class TestPublishedEntriesForText:
    def test_it_finds_an_entry_sharing_vocabulary(self, make_case, make_entry):
        entry = make_entry(make_case(AGENCY), "Agency staff spend", AGENCY)
        make_entry(
            make_case(POTHOLES, email="b@example.com"), "Potholes repaired", POTHOLES
        )

        hits = lexical.published_entries_for_text(AGENCY, 10)
        assert [h.pk for h in hits] == [entry.pk]

    def test_unpublished_entries_are_excluded(self, make_case, make_entry):
        from apps.publications.models import DisclosureLogEntry

        entry = make_entry(make_case(AGENCY), "Agency staff spend", AGENCY)
        entry.status = DisclosureLogEntry.Status.DRAFT
        entry.save()

        assert lexical.published_entries_for_text(AGENCY, 10) == []

    def test_nothing_is_excluded_by_default(self, make_case, make_entry):
        """Unlike `similar_published_entries`, which drops the case's own entry.
        Text passed here has never been saved, so it has no entry of its own."""
        entry = make_entry(make_case(AGENCY), "Agency staff spend", AGENCY)

        hits = lexical.published_entries_for_text(AGENCY, 10)
        assert entry.pk in {h.pk for h in hits}
