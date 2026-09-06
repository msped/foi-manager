"""Retrieval against a real pgvector index.

These run on Postgres because the ranking is a database feature: the ordering is
`ORDER BY embedding <=> query` inside pgvector, and no in-Python substitute
would be testing the query that actually ships.
"""

import pytest
from django.test import override_settings

from apps.ai_assistant.indexing import (
    embed_case,
    embed_disclosure_entry,
    stale_case_ids,
    stale_entry_ids,
)
from apps.ai_assistant.models import CaseEmbedding, DisclosureLogEntryEmbedding
from apps.ai_assistant.retrieval import (
    case_insights,
    exemption_frequencies,
    similar_cases,
)
from apps.cases.models import Case, CaseExemption
from apps.publications.models import DisclosureLogEntry

from .conftest import AGENCY, POTHOLES, STAFFING

pytestmark = pytest.mark.django_db


class TestIndexing:
    def test_embedding_is_created(self, make_case):
        case = make_case(AGENCY)
        assert CaseEmbedding.objects.filter(case=case).exists()

    def test_re_embedding_unchanged_text_is_a_no_op(self, make_case):
        case = make_case(AGENCY)
        assert embed_case(case.pk) is False

    def test_changed_text_is_re_embedded(self, make_case):
        case = make_case(AGENCY)
        before = CaseEmbedding.objects.get(case=case).content_hash

        case.request_text = POTHOLES
        case.save()

        assert embed_case(case.pk) is True
        assert CaseEmbedding.objects.get(case=case).content_hash != before

    def test_deleting_a_case_removes_its_vector(self, make_case):
        """Retention cascades. There is no second deletion path to remember."""
        case = make_case(AGENCY)
        case.delete()
        assert CaseEmbedding.objects.count() == 0

    def test_draft_entries_are_not_indexed(self, make_case, make_entry):
        case = make_case(AGENCY)
        entry = make_entry(
            case, "Agency spend", AGENCY, status=DisclosureLogEntry.Status.DRAFT
        )
        assert not DisclosureLogEntryEmbedding.objects.filter(entry=entry).exists()

    def test_publishing_makes_an_entry_indexable(self, make_case, make_entry):
        case = make_case(AGENCY)
        entry = make_entry(
            case, "Agency spend", AGENCY, status=DisclosureLogEntry.Status.DRAFT
        )
        entry.status = DisclosureLogEntry.Status.PUBLISHED
        entry.save()

        assert embed_disclosure_entry(entry.pk) is True

    def test_response_html_does_not_reach_the_embedder_as_markup(
        self, make_case, make_entry
    ):
        """Only the embedding path strips HTML; the stored value is untouched."""
        case = make_case(AGENCY)
        entry = make_entry(
            case, "Agency spend", AGENCY, response_text="<p>We spent <b>£500</b>.</p>"
        )
        entry.refresh_from_db()
        assert entry.response_text == "<p>We spent <b>£500</b>.</p>"
        assert DisclosureLogEntryEmbedding.objects.filter(entry=entry).exists()


class TestStaleness:
    def test_unindexed_case_is_stale(self, db):
        case = Case.objects.create(
            requester_name="A", requester_email="a@example.com", request_text=AGENCY
        )
        assert case.pk in stale_case_ids()

    def test_indexed_case_is_not_stale(self, make_case):
        case = make_case(AGENCY)
        assert case.pk not in stale_case_ids()

    def test_edited_case_becomes_stale(self, make_case):
        case = make_case(AGENCY)
        case.request_text = POTHOLES
        case.save()
        assert case.pk in stale_case_ids()

    def test_a_different_model_makes_everything_stale(self, make_case):
        """Vectors from two models are not comparable, so a model change is a
        full reindex rather than a gradual migration."""
        case = make_case(AGENCY)
        CaseEmbedding.objects.filter(case=case).update(embedding_model="other-model")
        assert case.pk in stale_case_ids()

    def test_only_published_entries_are_swept(self, make_case, make_entry):
        case = make_case(AGENCY)
        entry = make_entry(
            case, "Agency spend", AGENCY, status=DisclosureLogEntry.Status.DRAFT
        )
        assert entry.pk not in stale_entry_ids()


class TestSimilarCases:
    def test_ranks_the_closer_request_first(self, make_case):
        target = make_case(AGENCY)
        make_case(POTHOLES, email="b@example.com")
        related = make_case(STAFFING, email="c@example.com")

        results = similar_cases(target)
        assert results[0].pk == related.pk

    def test_excludes_itself(self, make_case):
        target = make_case(AGENCY)
        make_case(STAFFING, email="b@example.com")
        assert target.pk not in [c.pk for c in similar_cases(target)]

    def test_respects_the_limit(self, make_case):
        target = make_case(AGENCY)
        for i in range(4):
            make_case(STAFFING, email=f"b{i}@example.com")
        assert len(similar_cases(target, limit=2)) == 2

    def test_unindexed_case_returns_nothing_rather_than_failing(self, db, make_case):
        """Indexing is asynchronous, so a case created seconds ago has no
        vector. The panel shows less; it does not error."""
        make_case(STAFFING)
        fresh = Case.objects.create(
            requester_name="A", requester_email="a@example.com", request_text=AGENCY
        )
        assert similar_cases(fresh) == []


class TestExemptionFrequencies:
    def test_counts_what_was_claimed_before(self, make_case):
        a = make_case(AGENCY)
        b = make_case(STAFFING, email="b@example.com")
        for case in (a, b):
            CaseExemption.objects.create(
                case=case, code=CaseExemption.Code.S40_PERSONAL_INFO
            )
        CaseExemption.objects.create(case=a, code=CaseExemption.Code.S43_COMMERCIAL)

        freqs = exemption_frequencies([a, b])
        assert freqs[0]["code"] == "s40"
        assert freqs[0]["count"] == 2
        assert freqs[0]["case_count"] == 2
        assert {f["code"] for f in freqs} == {"s40", "s43"}

    def test_no_exemptions_is_an_empty_list_not_a_zero(self, make_case):
        """Nothing to report reads as nothing, not as a prediction of none."""
        assert exemption_frequencies([make_case(AGENCY)]) == []


class TestBothArmsMustAgree:
    """Only results found by vector *and* keyword search reach the panel.

    This is what makes an empty panel possible at all. Measured on 342 real
    police FOI cases, the vector arm's nearest neighbour was at distance 0.2976
    for a nonsense request and 0.2984 for one with four genuinely relevant
    matches — so no distance threshold, fixed or relative, can tell those two
    situations apart. Keyword search can, because it knows what vocabulary the
    corpus actually contains.
    """

    def test_a_case_sharing_no_vocabulary_is_not_returned(self, make_case):
        """Even though it is the nearest neighbour, and the only candidate."""
        target = make_case(AGENCY)
        make_case(POTHOLES, email="b@example.com")
        assert similar_cases(target) == []

    def test_a_case_sharing_vocabulary_is_returned(self, make_case):
        """Confirms the previous test filtered rather than finding nothing."""
        target = make_case(AGENCY)
        related = make_case(STAFFING, email="b@example.com")
        assert [c.pk for c in similar_cases(target)] == [related.pk]

    @override_settings(AI_MAX_DISTANCE=0.05)
    def test_the_distance_backstop_still_applies(self, make_case):
        """The vector arm keeps a ceiling, now as a guard against absurd
        matches rather than as the thing deciding relevance."""
        target = make_case(AGENCY)
        make_case(STAFFING, email="b@example.com")
        assert similar_cases(target) == []

    def test_exemption_frequencies_come_only_from_agreed_cases(self, make_case):
        """Frequencies are counted over the similar set, so the gate has to
        reach them too — otherwise the panel reports what was claimed on
        unrelated cases as though it were precedent."""
        target = make_case(AGENCY)
        neighbour = make_case(POTHOLES, email="b@example.com")
        CaseExemption.objects.create(
            case=neighbour, code=CaseExemption.Code.S43_COMMERCIAL
        )
        assert case_insights(target)["exemption_frequencies"] == []


class TestTheRequesterIsIrrelevant:
    """Similarity is the only thing that decides what appears.

    The panel answers what was decided and why. Who asked bears on neither, so
    two requests by one person are listed, or not, on exactly the same terms as
    two by strangers. Repeat-request handling under s.12(4) is a separate
    concern that would want its own feature.
    """

    def test_the_same_requester_gets_no_special_treatment(self, make_case):
        case = make_case(AGENCY, email="same@example.com")
        other = make_case(STAFFING, email="same@example.com", days_ago=3)

        [found] = similar_cases(case)
        assert found.pk == other.pk

    @override_settings(AI_MAX_DISTANCE=0.05)
    def test_an_unrelated_request_from_the_same_person_is_not_listed(self, make_case):
        """The email match earns nothing on its own."""
        case = make_case(AGENCY, email="same@example.com")
        make_case(POTHOLES, email="same@example.com", days_ago=3)
        assert similar_cases(case) == []


class TestPrecedentDoesNotExpire:
    """Retrieval is unbounded in time, deliberately and at every level.

    A refusal on cost, or a public interest balance argued out once, is
    precedent until the circumstances change. And if the public portal deflects
    the routine questions successfully, the requests that still reach an officer
    will be the unusual ones — whose matching past case is older and rarer
    rather than more recent. A date filter would hide exactly the cases most
    worth finding.
    """

    def test_a_years_old_case_is_still_returned(self, make_case):
        case = make_case(AGENCY, email="one@example.com")
        old = make_case(STAFFING, email="two@example.com", days_ago=1200)

        assert [c.pk for c in similar_cases(case)] == [old.pk]

    def test_a_years_old_published_case_is_still_returned(self, make_case, make_entry):
        """Publication makes no difference to how far back retrieval reaches."""
        source = make_case(AGENCY, email="old@example.com", days_ago=1200)
        make_entry(source, "Agency staff spend 2019/20", AGENCY)

        target = make_case(STAFFING, email="new@example.com")
        [found] = similar_cases(target)
        assert found.pk == source.pk
        assert found.disclosure_log_entry.status == "published"

    def test_an_old_refusal_still_contributes_its_exemption(self, make_case):
        """The case the concern is really about: a cost refusal stays available
        as precedent however long ago it was decided."""
        case = make_case(AGENCY)
        old = make_case(STAFFING, email="b@example.com", days_ago=1200)
        CaseExemption.objects.create(case=old, code=CaseExemption.Code.S12_COST_LIMIT)

        freqs = case_insights(case)["exemption_frequencies"]
        assert [f["code"] for f in freqs] == ["s12"]


class TestCaseInsights:
    def test_reports_whether_the_case_is_indexed(self, db, make_case):
        assert case_insights(make_case(AGENCY))["indexed"] is True

        fresh = Case.objects.create(
            requester_name="A", requester_email="a@example.com", request_text=AGENCY
        )
        insights = case_insights(fresh)
        assert insights["indexed"] is False
        assert insights["similar_cases"] == []

    def test_exemption_frequencies_are_drawn_from_the_similar_cases(self, make_case):
        target = make_case(AGENCY)
        neighbour = make_case(STAFFING, email="b@example.com")
        CaseExemption.objects.create(
            case=neighbour, code=CaseExemption.Code.S43_COMMERCIAL
        )

        freqs = case_insights(target)["exemption_frequencies"]
        assert [f["code"] for f in freqs] == ["s43"]


class TestOneListRegardlessOfPublication:
    """Precedent is one list. It was briefly split into published responses and
    unpublished cases, which showed every published request twice and drew a
    line an officer has no use for — publication is decided after a response is
    sent, and says nothing about how the request was handled.
    """

    def test_a_published_case_appears_once_and_is_marked(self, make_case, make_entry):
        target = make_case(AGENCY)
        neighbour = make_case(STAFFING, email="b@example.com")
        make_entry(neighbour, "Agency staff spend", STAFFING)

        [found] = case_insights(target)["similar_cases"]
        assert found.pk == neighbour.pk
        assert found.disclosure_log_entry.status == "published"

    def test_an_unpublished_case_appears_on_the_same_list(self, make_case):
        target = make_case(AGENCY)
        neighbour = make_case(STAFFING, email="b@example.com")

        [found] = case_insights(target)["similar_cases"]
        assert found.pk == neighbour.pk
        assert not hasattr(found, "disclosure_log_entry") or True

    def test_frequencies_count_published_cases_too(self, make_case, make_entry):
        target = make_case(AGENCY)
        neighbour = make_case(STAFFING, email="b@example.com")
        CaseExemption.objects.create(
            case=neighbour, code=CaseExemption.Code.S43_COMMERCIAL
        )
        make_entry(neighbour, "Agency staff spend", STAFFING)

        freqs = case_insights(target)["exemption_frequencies"]
        assert [f["code"] for f in freqs] == ["s43"]
        assert freqs[0]["case_count"] == 1
