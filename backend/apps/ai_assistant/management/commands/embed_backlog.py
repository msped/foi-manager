"""Bring the vector index in line with the text it is meant to describe.

The same reconciliation the periodic sweep performs, runnable directly. Wanted
in three situations the beat schedule handles badly: the first build of the
index over existing cases, a reindex after changing `OLLAMA_EMBED_MODEL`, and
checking what is outstanding without committing to fixing it.
"""

from django.core.management.base import BaseCommand

from apps.ai_assistant.embeddings import EmbeddingUnavailable, get_embedder
from apps.ai_assistant.indexing import (
    embed_case,
    embed_disclosure_entry,
    stale_case_ids,
    stale_entry_ids,
)


class Command(BaseCommand):
    help = "Embed cases and published disclosure log entries that need it."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be embedded without calling the model.",
        )
        parser.add_argument(
            "--async",
            action="store_true",
            dest="use_celery",
            help=(
                "Hand the work to Celery instead of doing it here. Faster to "
                "return, but failures surface in the worker log rather than "
                "on this terminal."
            ),
        )

    def handle(self, *args, **options):
        embedder = get_embedder()
        self.stdout.write(f"Embedder: {embedder.name}")

        case_ids = stale_case_ids()
        entry_ids = stale_entry_ids()
        self.stdout.write(
            f"{len(case_ids)} case(s) and {len(entry_ids)} entry(s) need embedding."
        )

        if options["dry_run"]:
            return

        if options["use_celery"]:
            from apps.ai_assistant.tasks import (
                task_embed_case,
                task_embed_disclosure_entry,
            )

            for case_id in case_ids:
                task_embed_case.delay(case_id)
            for entry_id in entry_ids:
                task_embed_disclosure_entry.delay(entry_id)
            self.stdout.write(self.style.SUCCESS("Queued."))
            return

        done = self._run(case_ids, embed_case, "case")
        done += self._run(entry_ids, embed_disclosure_entry, "entry")
        self.stdout.write(self.style.SUCCESS(f"Embedded {done} record(s)."))

    def _run(self, ids, embed, label):
        done = 0
        for pk in ids:
            try:
                if embed(pk):
                    done += 1
            except EmbeddingUnavailable as exc:
                # One unreachable model server should not look like a corpus
                # full of individually broken records.
                raise SystemExit(
                    self.style.ERROR(f"Embedder unavailable on {label} {pk}: {exc}")
                )
        return done
