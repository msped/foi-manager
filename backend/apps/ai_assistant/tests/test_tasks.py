import pytest
from django.core.management import call_command
from django.test import override_settings

from apps.ai_assistant.embeddings import EmbeddingUnavailable
from apps.ai_assistant.models import CaseEmbedding
from apps.ai_assistant.tasks import task_embed_case, task_sweep_stale_embeddings
from apps.cases.models import Case

from .conftest import AGENCY

pytestmark = pytest.mark.django_db


@pytest.fixture
def unindexed_case(db):
    return Case.objects.create(
        requester_name="A", requester_email="a@example.com", request_text=AGENCY
    )


class TestEmbedTask:
    def test_indexes_a_case(self, unindexed_case):
        assert task_embed_case(unindexed_case.pk) is True
        assert CaseEmbedding.objects.filter(case=unindexed_case).exists()

    def test_a_deleted_case_is_not_an_error(self, db):
        """The row can go between the signal firing and the worker picking it
        up. The cascade already removed the vector; there is nothing to retry."""
        assert task_embed_case(999999) is False

    def test_an_unavailable_embedder_is_retried(self, unindexed_case, monkeypatch):
        """Retry rather than fail: a model server that is down, restarting or
        still pulling comes back, and recording a wrong vector meanwhile would
        be worse than recording none.

        Asserts that `retry` is reached, rather than asserting on a `Retry`
        exception. Celery only turns `self.retry()` into `Retry` inside a
        worker — called directly or through `.apply()` it re-raises the original
        exception — so an exception-based assertion here would pass identically
        with no retry configured at all.
        """
        retried = []

        def fake_retry(exc=None, **kwargs):
            retried.append(exc)
            raise RuntimeError("retry reached")

        def boom(case_id):
            raise EmbeddingUnavailable("connection refused")

        monkeypatch.setattr("apps.ai_assistant.indexing.embed_case", boom)
        monkeypatch.setattr(task_embed_case, "retry", fake_retry)

        with pytest.raises(RuntimeError, match="retry reached"):
            task_embed_case(unindexed_case.pk)
        assert isinstance(retried[0], EmbeddingUnavailable)

    def test_other_failures_are_not_retried(self, unindexed_case, monkeypatch):
        """A bug should surface, not be re-attempted five times over ten
        minutes and then vanish into a dead letter."""
        retried = []

        def fake_retry(exc=None, **kwargs):
            retried.append(exc)
            raise RuntimeError("retry reached")

        def boom(case_id):
            raise ValueError("a bug")

        monkeypatch.setattr("apps.ai_assistant.indexing.embed_case", boom)
        monkeypatch.setattr(task_embed_case, "retry", fake_retry)

        with pytest.raises(ValueError, match="a bug"):
            task_embed_case(unindexed_case.pk)
        assert retried == []


class TestSweep:
    def test_queues_everything_that_needs_indexing(self, unindexed_case):
        with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
            result = task_sweep_stale_embeddings()
        assert result["cases"] == 1
        assert CaseEmbedding.objects.filter(case=unindexed_case).exists()

    def test_a_fully_indexed_corpus_queues_nothing(self, make_case):
        make_case(AGENCY)
        with override_settings(CELERY_TASK_ALWAYS_EAGER=True):
            assert task_sweep_stale_embeddings() == {"cases": 0, "entries": 0}


class TestEmbedBacklogCommand:
    def test_embeds_the_backlog(self, unindexed_case):
        call_command("embed_backlog")
        assert CaseEmbedding.objects.filter(case=unindexed_case).exists()

    def test_dry_run_changes_nothing(self, unindexed_case):
        call_command("embed_backlog", "--dry-run")
        assert not CaseEmbedding.objects.filter(case=unindexed_case).exists()
