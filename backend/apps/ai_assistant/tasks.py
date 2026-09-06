"""Celery entry points for indexing.

Thin wrappers. The work lives in `indexing.py` so it can be run without a
broker; these add retries and the fan-out from the sweep.
"""

import logging

from config.celery import app

from .embeddings import EmbeddingUnavailable

logger = logging.getLogger(__name__)


@app.task(bind=True, max_retries=5, default_retry_delay=120)
def task_embed_case(self, case_id: int):
    """Index one case.

    Retries only on the embedder being unavailable — a model server that is
    down, restarting, or still pulling the model comes back, and until it does
    the right behaviour is to wait rather than to record a wrong vector. Any
    other exception is a bug and should surface.
    """
    from .indexing import embed_case

    try:
        return embed_case(case_id)
    except EmbeddingUnavailable as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=5, default_retry_delay=120)
def task_embed_disclosure_entry(self, entry_id: int):
    from .indexing import embed_disclosure_entry

    try:
        return embed_disclosure_entry(entry_id)
    except EmbeddingUnavailable as exc:
        raise self.retry(exc=exc)


@app.task
def task_sweep_stale_embeddings():
    """Find everything whose vector no longer matches its text and re-queue it.

    The reconciler behind the signals. Signals fire once and cannot tell whether
    the worker on the other end succeeded; this notices whatever they missed —
    a dropped task, a bulk update that fired no signal, a model change, a
    restore from backup.

    Fans out to per-record tasks rather than embedding inline so one unreachable
    model server cannot strand a long sweep half-done, and so the retry policy
    above applies per record.
    """
    from .indexing import stale_case_ids, stale_entry_ids

    case_ids = stale_case_ids()
    entry_ids = stale_entry_ids()

    for case_id in case_ids:
        task_embed_case.delay(case_id)
    for entry_id in entry_ids:
        task_embed_disclosure_entry.delay(entry_id)

    logger.info(
        "Embedding sweep queued %d case(s) and %d disclosure log entry(s)",
        len(case_ids),
        len(entry_ids),
    )
    return {"cases": len(case_ids), "entries": len(entry_ids)}
