"""Retrieval for the surfaces an anonymous member of the public can reach.

Separate from `retrieval.py` because almost every constraint is inverted, and
keeping the two in one file would mean re-reading which set applies on every
line.

**Different corpus, for disclosure reasons rather than relevance ones.** The
internal panel searches cases. Cases hold the requester's name and address, an
officer's notes, and requests that were refused and never published. None of
that may leave the building, so nothing here touches `CaseEmbedding` at all —
only `DisclosureLogEntryEmbedding`, whose text a person has decided to publish.

**No case is excluded, and no result is identified beyond what the disclosure
log already shows.** Everything returned here is already reachable by walking
`/disclosure-log`. This endpoint changes how it is found, not what is findable.

**The query is a stranger's text, not a stored row.** It arrives unembedded, so
serving it needs the model up — unlike the internal panel, which reads a vector
written hours earlier and never calls Ollama at all. That is the operational
cost of this feature: `brew services stop ollama` stops being free once this
ships. It is also why failure is designed to be silent. Every path that cannot
produce an answer returns an empty list, and the caller shows nothing, because
the alternative is standing between someone and a statutory right with an error
message about a machine learning model.
"""

import logging

from django.conf import settings
from pgvector.django import CosineDistance

from apps.publications.models import DisclosureLogEntry

from . import lexical
from .embeddings import EmbeddingUnavailable, get_embedder
from .models import DisclosureLogEntryEmbedding
from .retrieval import CANDIDATE_DEPTH, fuse
from .text import normalise

logger = logging.getLogger(__name__)

#: Shortest text worth embedding, in characters.
#:
#: Two reasons, and the second is the load-bearing one.
#:
#: A handful of words cannot support the agreement gate — there is not enough
#: vocabulary for the lexical arm to find anything distinctive in, so the fusion
#: either returns nothing or agrees on an accident.
#:
#: More seriously, `nomic-embed-text` returns byte-identical vectors for very
#: short inputs on Ollama's CPU backend. It behaves correctly on Metal, so this
#: is invisible in development and appears only in production, where every
#: short query would silently match the same arbitrary entry with high
#: confidence. 40 characters is comfortably past the range where that was
#: observed and still shorter than any real FOI request — "Please provide the
#: number of dog attacks recorded in 2024" is 55.
#:
#: This guard is why the request form is safe to ship while the disclosure log
#: search is not: a drafted request always clears it, and a search box is
#: exactly the case that does not.
MIN_QUERY_CHARS = 40


def suggest_published_entries(request_text: str, limit=None):
    """Published entries that may already answer a request being written.

    Matched against `request_vector` — the published request, not the published
    answer. Someone part-way through writing a request is looking for a request
    like theirs; the answer they want is whatever that request got, however it
    happens to be worded.

    Returns entries best first, or an empty list, which is an ordinary outcome
    rather than an error. Most requests are novel, and the gate is built so that
    saying nothing is possible.
    """
    text = normalise(request_text)
    if len(text) < MIN_QUERY_CHARS:
        return []

    limit = limit or settings.AI_PUBLIC_RESULT_COUNT

    try:
        vector = get_embedder().embed_query(
            text, timeout=settings.AI_EMBED_TIMEOUT_QUERY
        )
    except EmbeddingUnavailable as exc:
        # Warned rather than raised. The lexical arm alone cannot be shown —
        # without a second arm to agree with there is no gate, and the whole
        # argument for putting these in front of the public is that both methods
        # found them. So this degrades to no suggestions, which is the state the
        # form is built to handle anyway.
        logger.warning("Public suggestions unavailable, no embedding: %s", exc)
        return []

    vector_ranked = list(
        DisclosureLogEntryEmbedding.objects
        # Publication is revocable. `unpublish` and `reject` set the entry's
        # status back without touching its embedding row — `embed_disclosure_entry`
        # returns early for anything unpublished, so the stale vector survives —
        # and `stale_entry_ids` only sweeps published entries, so nothing ever
        # cleans it up. Without this join an entry withdrawn from the disclosure
        # log would keep being recommended to the public by reference and date.
        .filter(entry__status=DisclosureLogEntry.Status.PUBLISHED)
        .annotate(distance=CosineDistance("request_vector", vector))
        .filter(distance__lte=settings.AI_MAX_DISTANCE)
        .order_by("distance")
        .values_list("entry_id", flat=True)[:CANDIDATE_DEPTH]
    )

    lexical_hits = lexical.published_entries_for_text(text, CANDIDATE_DEPTH)

    ordered_ids = fuse(vector_ranked, [e.pk for e in lexical_hits], limit)
    if not ordered_ids:
        return []

    by_id = {
        entry.pk: entry
        for entry in DisclosureLogEntry.objects.filter(
            pk__in=ordered_ids,
            status=DisclosureLogEntry.Status.PUBLISHED,
        ).select_related("case")
    }
    return [by_id[pk] for pk in ordered_ids if pk in by_id]


#: How many scheme entries the request form will offer.
#:
#: Lower than `AI_PUBLIC_RESULT_COUNT` on purpose. These sit in a second section
#: below the published responses, and the whole screen is an interruption
#: between someone and a statutory right — a long one earns being skipped, which
#: costs the deflection the section exists for.
SCHEME_RESULT_COUNT = 3


def suggest_scheme_entries(request_text: str, limit=None):
    """Publication scheme entries that may already cover a request.

    A weaker and broader claim than `suggest_published_entries`, and the two
    are kept apart rather than merged into one ranked list for that reason. A
    disclosure log hit says someone asked this exact question and here is the
    reply. A scheme hit says we publish this sort of thing routinely and here is
    where it lives. One list would need one heading, and no heading is honest
    about both.

    No embedding call, so unlike its neighbour above this keeps working with
    Ollama stopped. It shares the same posture on failure regardless: an empty
    list is an ordinary outcome, and most requests will get one.
    """
    text = normalise(request_text)
    # The same floor the published-entry search uses. Applied here for the
    # first of the two reasons given at `MIN_QUERY_CHARS` rather than the
    # second — nothing is embedded on this path, so the degenerate-vector bug
    # cannot bite, but a handful of words still cannot support a gate that asks
    # for two distinctive terms.
    if len(text) < MIN_QUERY_CHARS:
        return []

    return lexical.scheme_entries_for_text(text, limit or SCHEME_RESULT_COUNT)
