import pytest
import requests
from django.test import override_settings

from apps.ai_assistant.embeddings import (
    DOCUMENT_PREFIX,
    QUERY_PREFIX,
    EmbeddingUnavailable,
    OllamaEmbedder,
    StubEmbedder,
    _coerce_keep_alive,
    get_embedder,
)


class TestStubEmbedder:
    def test_dimensions_match_the_columns(self):
        assert len(StubEmbedder().embed_document("anything")) == 768

    def test_deterministic(self):
        assert StubEmbedder().embed_document("agency staff") == (
            StubEmbedder().embed_document("agency staff")
        )

    def test_shared_vocabulary_scores_higher_than_none(self):
        """The property that makes the stub usable as a test double.

        Random vectors would let a retrieval test pass while proving nothing —
        the ranking assertions would come out right or wrong by luck. Because
        this is a hashing trick over tokens, texts that share words genuinely
        land closer together, so a ranking assertion means something.
        """
        stub = StubEmbedder()
        query = stub.embed_query("council spending on agency staff")
        related = stub.embed_document("agency staff spending by the council")
        unrelated = stub.embed_document("potholes repaired on adopted highways")

        def dot(a, b):
            return sum(x * y for x, y in zip(a, b))

        assert dot(query, related) > dot(query, unrelated)

    def test_empty_input_is_a_unit_vector(self):
        """A zero vector has no direction, so cosine distance to it is
        undefined and Postgres would return NaN rather than an error."""
        vector = StubEmbedder().embed_document("   ")
        assert abs(sum(v * v for v in vector) - 1.0) < 1e-9


class TestKeepAliveCoercion:
    def test_unitless_string_becomes_a_number(self):
        """`-1` is the documented value and arrives from the environment as a
        string, which Ollama rejects: it parses a string as a Go duration and
        a unitless one is a 400 on every request."""
        assert _coerce_keep_alive("-1") == -1

    def test_duration_strings_are_left_alone(self):
        assert _coerce_keep_alive("-1m") == "-1m"
        assert _coerce_keep_alive("10m") == "10m"

    def test_numbers_pass_through(self):
        assert _coerce_keep_alive(-1) == -1


class _FakeResponse:
    def __init__(self, payload, status_code=200, text=""):
        self._payload = payload
        self.status_code = status_code
        self.text = text

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")
        return None

    def json(self):
        return self._payload


def _overflow_response():
    """What Ollama actually returns for an input past the context window."""
    return _FakeResponse(
        {},
        status_code=400,
        text='{"error":"the input length exceeds the context length"}',
    )


class TestOllamaEmbedder:
    def test_applies_the_task_prefixes(self, monkeypatch):
        """Ollama adds no prefix of its own — `ollama show nomic-embed-text`
        declares no template — so these have to be sent explicitly."""
        sent = {}

        def fake_post(url, json, timeout):
            sent.update(json)
            return _FakeResponse({"embeddings": [[0.0] * 768]})

        monkeypatch.setattr(requests, "post", fake_post)

        OllamaEmbedder().embed_document("agency staff", timeout=5)
        assert sent["input"] == DOCUMENT_PREFIX + "agency staff"

        OllamaEmbedder().embed_query("agency staff", timeout=5)
        assert sent["input"] == QUERY_PREFIX + "agency staff"

    def test_sends_keep_alive(self, monkeypatch):
        sent = {}

        def fake_post(url, json, timeout):
            sent.update(json)
            return _FakeResponse({"embeddings": [[0.0] * 768]})

        monkeypatch.setattr(requests, "post", fake_post)
        OllamaEmbedder(keep_alive="-1m").embed_document("x", timeout=5)
        assert sent["keep_alive"] == "-1m"

    def test_unreachable_server_raises_embedding_unavailable(self, monkeypatch):
        def fake_post(url, json, timeout):
            raise requests.ConnectionError("refused")

        monkeypatch.setattr(requests, "post", fake_post)
        with pytest.raises(EmbeddingUnavailable):
            OllamaEmbedder().embed_document("x", timeout=5)

    def test_wrong_dimensions_are_rejected_before_the_database(self, monkeypatch):
        """Caught here so the message names the misconfigured setting rather
        than a column width."""

        def fake_post(url, json, timeout):
            return _FakeResponse({"embeddings": [[0.0] * 384]})

        monkeypatch.setattr(requests, "post", fake_post)
        with pytest.raises(EmbeddingUnavailable, match="384"):
            OllamaEmbedder().embed_document("x", timeout=5)

    def test_empty_response_is_unavailable(self, monkeypatch):
        def fake_post(url, json, timeout):
            return _FakeResponse({"embeddings": []})

        monkeypatch.setattr(requests, "post", fake_post)
        with pytest.raises(EmbeddingUnavailable):
            OllamaEmbedder().embed_document("x", timeout=5)


class TestContextOverflow:
    """Real disclosure log responses overflow the context window.

    The design assumed nomic's 8192 tokens meant this could not happen. A table
    of figures extracted from a PDF tokenises at close to one token per
    character, so a 56,000-character response overflowed a window that fits
    several times that much prose.
    """

    def test_too_long_input_is_retried_shorter(self, monkeypatch):
        seen = []

        def fake_post(url, json, timeout):
            seen.append(len(json["input"]))
            # Mimics the model: rejects anything over 1,000 characters.
            if len(json["input"]) > 1000:
                return _overflow_response()
            return _FakeResponse({"embeddings": [[0.0] * 768]})

        monkeypatch.setattr(requests, "post", fake_post)
        vector = OllamaEmbedder().embed_document("x" * 5000, timeout=5)

        assert len(vector) == 768
        assert len(seen) > 1, "should have retried"
        assert seen == sorted(seen, reverse=True), "each retry should be shorter"

    def test_the_task_prefix_survives_truncation(self, monkeypatch):
        """Truncating the prefix off would silently change what is being asked
        of the model, and a threshold calibrated one way would be applied the
        other."""
        seen = []

        def fake_post(url, json, timeout):
            seen.append(json["input"])
            if len(json["input"]) > 1000:
                return _overflow_response()
            return _FakeResponse({"embeddings": [[0.0] * 768]})

        monkeypatch.setattr(requests, "post", fake_post)
        OllamaEmbedder().embed_document("x" * 5000, timeout=5)

        assert all(sent.startswith(DOCUMENT_PREFIX) for sent in seen)

    def test_other_400s_are_not_retried(self, monkeypatch):
        """Only the context-length complaint is retryable by shortening. Any
        other 400 is a request this client is building wrong."""
        calls = []

        def fake_post(url, json, timeout):
            calls.append(1)
            return _FakeResponse(
                {}, status_code=400, text='{"error":"missing unit in duration"}'
            )

        monkeypatch.setattr(requests, "post", fake_post)
        with pytest.raises(EmbeddingUnavailable):
            OllamaEmbedder().embed_document("x" * 5000, timeout=5)
        assert len(calls) == 1

    def test_gives_up_rather_than_looping(self, monkeypatch):
        def fake_post(url, json, timeout):
            return _overflow_response()

        monkeypatch.setattr(requests, "post", fake_post)
        with pytest.raises(EmbeddingUnavailable, match="truncation"):
            OllamaEmbedder().embed_document("x" * 5000, timeout=5)


class TestGetEmbedder:
    def test_tests_never_reach_for_a_model_server(self):
        assert isinstance(get_embedder(), StubEmbedder)

    @override_settings(AI_EMBEDDING_BACKEND="ollama")
    def test_not_cached_so_settings_overrides_apply(self):
        assert isinstance(get_embedder(), OllamaEmbedder)
