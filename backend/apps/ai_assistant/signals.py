"""Enqueue indexing when the text behind a vector changes.

`transaction.on_commit` throughout: a task queued inside an open transaction can
reach a worker before the transaction commits, and the worker would then read
the row as it was before the save — or not find it at all.

These are the fast path, not the guarantee. Anything they miss is picked up by
`task_sweep_stale_embeddings`.
"""

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.cases.models import Case
from apps.publications.models import DisclosureLogEntry


@receiver(post_save, sender=Case, dispatch_uid="ai_assistant.embed_case")
def enqueue_case_embedding(sender, instance, **kwargs):
    from .tasks import task_embed_case

    transaction.on_commit(lambda: task_embed_case.delay(instance.pk))


@receiver(post_save, sender=DisclosureLogEntry, dispatch_uid="ai_assistant.embed_entry")
def enqueue_entry_embedding(sender, instance, **kwargs):
    """Fires on every save, including the one that publishes an entry.

    No status check here: publishing is an ordinary save, and `embed_disclosure_
    entry` already declines to index anything that is not published. Filtering
    at this end would mean maintaining the same rule twice.
    """
    from .tasks import task_embed_disclosure_entry

    transaction.on_commit(lambda: task_embed_disclosure_entry.delay(instance.pk))
