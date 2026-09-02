"""Turning text into vectors, and the seam that lets tests do it without Ollama.

Two callers with opposite needs share this module. Indexing runs in Celery: it
can wait, and it must not silently produce nothing. Querying runs inside a
request: it must not wait, and producing nothing is an acceptable answer because
every surface that asks has a keyword search to fall back to. That difference is
carried by the timeout the caller passes, not by two clients.
"""

import hashlib
import logging
import math
import re

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

#: nomic-embed-text is trained with task prefixes. Ollama does not add them —
#: `ollama show nomic-embed-text` lists no template, and input is passed through
#: verbatim — so they are applied here.
#:
#: Measured on a small set of FOI-shaped request/response pairs, prefixing left
#: the ranking untouched (both orderings identical, 6/6 correct) and lowered the
#: mean margin between first and second place from 0.164 to 0.136. That set was
#: too easy to separate the two on quality, so it is not evidence against the
#: model card; it is evidence that the choice is invisible to anything that only
#: sorts, and visible to anything that compares against a number.
#:
#: Which is the reason to fix it now. The internal panel is threshold-free and
#: cannot be affected either way, but the public surface will get a threshold
#: from a labelled golden set — and that set has to be labelled with the same
#: pairing that ships, or it calibrates against a score range that does not
#: exist in production.
DOCUMENT_PREFIX = "search_document: "
QUERY_PREFIX = "search_query: "


#: Ollama's wording when the input will not fit the model's context window.
_CONTEXT_OVERFLOW = "exceeds the context length"

#: Shrink factor per retry. 0.6 rather than 0.5 so prose, which typically
#: overflows only slightly, keeps more of itself than halving would leave.
_TRUNCATION_FACTOR = 0.6

#: Four attempts takes a 56,000-character response under 8,000, which is the
#: measured limit for the worst input in this corpus — dense numeric tables.
_MAX_TRUNCATION_ATTEMPTS = 6


class _ContextOverflow(Exception):
    """Internal: the input was too long. Retryable by shortening it."""


class EmbeddingUnavailable(Exception):
    """The embedder could not be reached, or gave back something unusable.

    Query paths catch this and fall back to keyword search. Indexing paths let
    it propagate so Celery retries rather than storing a vector that is wrong.
    """


def _coerce_keep_alive(value):
    """Send `keep_alive` in a form Ollama will accept.

    Ollama takes either a number of seconds or a Go duration string, and a
    unitless string is neither: `"-1"` comes back as
    `{"error":"time: missing unit in duration \\"-1\\""}` — a 400 on every
    request. Environment variables arrive as strings, and `-1` is the value
    every piece of documentation quotes, so that combination is the likely one.

    Worth defending against rather than documenting, because of how it fails:
    query paths treat an unreachable embedder as "no suggestions", so the whole
    feature would be silently absent with nothing logged and nothing broken.
    """
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            # A real duration string like "-1m" or "10m". Leave it alone.
            return value
    return value


class OllamaEmbedder:
    """Embeddings from a local Ollama server.

    Uses `/api/embed` (the current endpoint) rather than the deprecated
    `/api/embeddings`, because only the former accepts `keep_alive` — and
    without that, an idle model is unloaded after five minutes and every embed
    on a quiet service pays a cold start.
    """

    def __init__(self, base_url=None, model=None, keep_alive=None):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.model = model or settings.OLLAMA_EMBED_MODEL
        self.keep_alive = _coerce_keep_alive(
            keep_alive if keep_alive is not None else settings.OLLAMA_KEEP_ALIVE
        )

    @property
    def name(self) -> str:
        """Stamped onto every stored vector, so a model change is detectable."""
        return self.model

    def embed_document(self, text: str, timeout: float) -> list[float]:
        return self._embed(DOCUMENT_PREFIX, text, timeout)

    def embed_query(self, text: str, timeout: float) -> list[float]:
        return self._embed(QUERY_PREFIX, text, timeout)

    def _embed(self, prefix: str, text: str, timeout: float) -> list[float]:
        """Embed `text`, shortening it if the model will not take it whole.

        The design assumed nomic's 8192-token window meant no input would ever
        need truncating. Real disclosure log responses disproved that: a table
        of figures pulled out of a PDF with `-layout` tokenises at close to one
        token per character, so a 56,000-character response overflowed a window
        that comfortably fits several times that much prose.

        Retrying on the model's own complaint rather than pre-truncating to a
        fixed character budget, because the two cases differ by roughly four
        times. A fixed budget safe for tables would throw away most of every
        long prose answer, and one sized for prose would still fail here.
        """
        remaining = text
        for _ in range(_MAX_TRUNCATION_ATTEMPTS):
            try:
                return self._post(prefix + remaining, timeout)
            except _ContextOverflow:
                if not remaining:
                    raise EmbeddingUnavailable(
                        f"{self.model} rejected even an empty input as too long"
                    )
                remaining = remaining[: int(len(remaining) * _TRUNCATION_FACTOR)]
                logger.warning(
                    "Input too long for %s; retrying with %d of %d characters. "
                    "The tail is not embedded, so it cannot be matched against.",
                    self.model,
                    len(remaining),
                    len(text),
                )

        raise EmbeddingUnavailable(
            f"{self.model} still rejected the input after "
            f"{_MAX_TRUNCATION_ATTEMPTS} truncations"
        )

    def _post(self, text: str, timeout: float) -> list[float]:
        try:
            response = requests.post(
                f"{self.base_url}/api/embed",
                json={
                    "model": self.model,
                    "input": text,
                    "keep_alive": self.keep_alive,
                },
                timeout=timeout,
            )
            # Checked before `raise_for_status`, which discards the body — and
            # the body is the only thing distinguishing "too long" (retryable by
            # shortening) from every other 400 (not retryable at all).
            if response.status_code == 400 and _CONTEXT_OVERFLOW in response.text:
                raise _ContextOverflow
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise EmbeddingUnavailable(str(exc)) from exc

        # `/api/embed` batches, so it always answers with a list of vectors even
        # for a single input.
        embeddings = payload.get("embeddings") or []
        if not embeddings or not embeddings[0]:
            raise EmbeddingUnavailable(
                f"{self.model} returned no embedding for a {len(text)}-character input"
            )

        vector = embeddings[0]
        expected = settings.AI_EMBEDDING_DIMENSIONS
        if len(vector) != expected:
            # Storing this would raise at the database anyway, but the message
            # there names a column rather than the cause. The cause is that
            # OLLAMA_EMBED_MODEL and AI_EMBEDDING_DIMENSIONS disagree.
            raise EmbeddingUnavailable(
                f"{self.model} returned {len(vector)} dimensions, "
                f"but AI_EMBEDDING_DIMENSIONS is {expected}"
            )
        return vector


_TOKEN_RE = re.compile(r"[a-z0-9']+")


class StubEmbedder:
    """A deterministic embedder for tests and CI, where no model server exists.

    Not random vectors. Random vectors would let a test prove that retrieval
    returns *something* while proving nothing about whether it returns the right
    thing — the ranking assertions would pass or fail by luck. This is the
    hashing trick: tokens are hashed into dimensions and the result normalised,
    so texts that share vocabulary genuinely land near each other and a test can
    assert that the entry about council spending outranks the one about
    potholes.

    It has no idea what words mean, so it is a test double, not a fallback. It
    is selected only by `AI_EMBEDDING_BACKEND`, never on error.
    """

    name = "stub"

    def __init__(self, dimensions=None):
        self.dimensions = dimensions or settings.AI_EMBEDDING_DIMENSIONS

    def embed_document(self, text: str, timeout: float = 0) -> list[float]:
        return self._embed(text)

    def embed_query(self, text: str, timeout: float = 0) -> list[float]:
        # No prefix. The real model puts queries and documents in deliberately
        # different places; imitating that here would only add noise to a
        # similarity that is already just vocabulary overlap.
        return self._embed(text)

    def _embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        for token in _TOKEN_RE.findall(text.lower()):
            digest = hashlib.sha256(token.encode()).digest()
            index = int.from_bytes(digest[:4], "big") % self.dimensions
            # The sign bit spreads collisions apart instead of letting every
            # unrelated token that lands in a dimension reinforce the others.
            sign = 1.0 if digest[4] & 1 else -1.0
            vector[index] += sign

        norm = math.sqrt(sum(v * v for v in vector))
        if norm == 0:
            # Empty or punctuation-only input. A zero vector has no direction,
            # so cosine distance against it is undefined; this keeps it a unit
            # vector that is simply far from everything real.
            vector[0] = 1.0
            return vector
        return [v / norm for v in vector]


def get_embedder():
    """The embedder this environment is configured to use.

    Deliberately not cached: `override_settings` in a test would otherwise be
    ignored, and constructing one is a few attribute reads.
    """
    if settings.AI_EMBEDDING_BACKEND == "stub":
        return StubEmbedder()
    return OllamaEmbedder()
