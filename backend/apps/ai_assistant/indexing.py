"""Producing and refreshing stored vectors.

Kept separate from `tasks.py` so the work can be called directly — from a
management command, a shell, or a test — without going through a broker.

Two mechanisms keep the index current, because neither is sufficient alone. A
signal enqueues the record that just changed, which is fast but only ever fires
once and cannot know whether the worker on the other end succeeded. The sweep
compares stored hashes against current text and repairs whatever disagrees,
which catches everything the signals missed — a dropped task, a bulk update, a
model change, a restore from backup — but only when it runs.
"""

import logging

from django.conf import settings
from django.db.models import Q

from apps.cases.models import Case
from apps.publications.models import DisclosureLogEntry

from .embeddings import get_embedder
from .models import CaseEmbedding, DisclosureLogEntryEmbedding
from .text import (
    case_request_text,
    content_hash,
    entry_answer_text,
    entry_request_text,
)

logger = logging.getLogger(__name__)


def embed_case(case_id: int) -> bool:
    """Refresh one case's vector. True if it was written, False if unchanged.

    Idempotent by hash, so a duplicated task or an over-eager signal costs a
    lookup rather than a model call.
    """
    case = Case.objects.filter(pk=case_id).first()
    if case is None:
        # Deleted between the signal firing and the worker picking it up. The
        # cascade already removed any vector; nothing to do.
        return False

    text = case_request_text(case)
    if not text:
        return False

    embedder = get_embedder()
    digest = content_hash(text)

    existing = CaseEmbedding.objects.filter(case=case).first()
    if existing is not None and not existing.is_stale(digest, embedder.name):
        return False

    vector = embedder.embed_document(text, timeout=settings.AI_EMBED_TIMEOUT_INDEX)

    CaseEmbedding.objects.update_or_create(
        case=case,
        defaults={
            "request_vector": vector,
            "embedding_model": embedder.name,
            "content_hash": digest,
        },
    )
    return True


def embed_disclosure_entry(entry_id: int) -> bool:
    """Refresh one published entry's vectors. True if written.

    Only published entries are indexed. A draft is not visible on any surface
    that searches, and its text is still being edited, so embedding it buys a
    vector that will be stale before anything can use it.
    """
    entry = DisclosureLogEntry.objects.filter(pk=entry_id).first()
    if entry is None:
        return False
    if entry.status != DisclosureLogEntry.Status.PUBLISHED:
        return False

    request_text = entry_request_text(entry)
    answer_text = entry_answer_text(entry)
    if not request_text:
        # Nothing to match a request against. An answer vector on its own would
        # be reachable from the disclosure log search but not from the request
        # form, which is a confusing half-indexed state; skip until it has a
        # title or summary.
        return False

    embedder = get_embedder()
    digest = content_hash(request_text, answer_text)

    existing = DisclosureLogEntryEmbedding.objects.filter(entry=entry).first()
    if existing is not None and not existing.is_stale(digest, embedder.name):
        return False

    request_vector = embedder.embed_document(
        request_text, timeout=settings.AI_EMBED_TIMEOUT_INDEX
    )
    answer_vector = (
        embedder.embed_document(answer_text, timeout=settings.AI_EMBED_TIMEOUT_INDEX)
        if answer_text
        else None
    )

    DisclosureLogEntryEmbedding.objects.update_or_create(
        entry=entry,
        defaults={
            "request_vector": request_vector,
            "answer_vector": answer_vector,
            "embedding_model": embedder.name,
            "content_hash": digest,
        },
    )
    return True


def stale_case_ids() -> list[int]:
    """Cases whose stored vector is missing, outdated, or from another model."""
    model_name = get_embedder().name

    # Defer the vectors. This walks every case, and the column it does not need
    # is by far the widest one on the table.
    candidates = Case.objects.filter(
        Q(embedding__isnull=True) | ~Q(embedding__embedding_model=model_name)
    ).values_list("pk", flat=True)
    stale = set(candidates)

    matching = Case.objects.filter(embedding__embedding_model=model_name).only(
        "pk", "summary", "request_text"
    )
    for case in matching.iterator():
        text = case_request_text(case)
        if not text:
            continue
        if case.embedding.content_hash != content_hash(text):
            stale.add(case.pk)

    return sorted(stale)


def stale_entry_ids() -> list[int]:
    """Published entries whose stored vectors no longer match their text."""
    model_name = get_embedder().name
    published = DisclosureLogEntry.objects.filter(
        status=DisclosureLogEntry.Status.PUBLISHED
    )

    candidates = published.filter(
        Q(embedding__isnull=True) | ~Q(embedding__embedding_model=model_name)
    ).values_list("pk", flat=True)
    stale = set(candidates)

    matching = published.filter(embedding__embedding_model=model_name).only(
        "pk", "title", "summary", "response_text"
    )
    for entry in matching.iterator():
        request_text = entry_request_text(entry)
        if not request_text:
            continue
        digest = content_hash(request_text, entry_answer_text(entry))
        if entry.embedding.content_hash != digest:
            stale.add(entry.pk)

    return sorted(stale)
