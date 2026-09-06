import pytest
from django.test import override_settings

from apps.ai_assistant.checks import (
    embedding_dimensions_agree,
    embeddings_match_the_configured_model,
    pgvector_extension_is_installed,
)
from apps.ai_assistant.models import CaseEmbedding

from .conftest import AGENCY

pytestmark = pytest.mark.django_db


class TestPgvectorCheck:
    def test_quiet_when_the_extension_is_present(self):
        """The migration creates it, so on a working install this says nothing.

        It exists for the case it cannot fix: prod points at an external
        database where CREATE EXTENSION needs privileges a managed user is
        often not granted.
        """
        assert pgvector_extension_is_installed(None) == []


class TestDimensionCheck:
    def test_quiet_when_settings_match_the_columns(self):
        assert embedding_dimensions_agree(None) == []

    @override_settings(AI_EMBEDDING_DIMENSIONS=1024)
    def test_warns_when_they_disagree(self):
        """Otherwise the first symptom is a database error on every write, with
        no mention of the setting that caused it."""
        warnings = embedding_dimensions_agree(None)
        assert [w.id for w in warnings] == ["ai.W002"]
        assert "1024" in warnings[0].msg


class TestModelStampCheck:
    def test_quiet_when_every_vector_is_from_the_current_model(self, make_case):
        make_case(AGENCY)
        assert embeddings_match_the_configured_model(None) == []

    def test_warns_about_vectors_from_another_model(self, make_case):
        """A mixed index is worse than an empty one: an empty one falls back to
        keyword search, and a mixed one confidently ranks noise."""
        case = make_case(AGENCY)
        CaseEmbedding.objects.filter(case=case).update(embedding_model="bge-m3")

        warnings = embeddings_match_the_configured_model(None)
        assert [w.id for w in warnings] == ["ai.W003"]
        assert "bge-m3" in warnings[0].msg
