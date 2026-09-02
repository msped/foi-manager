"""Show both retrieval arms and what they agree on, for one case.

Development tooling. The panel deliberately shows no scores — a number beside a
suggestion reads as a measurement of relevance and is nothing of the sort. Here
the numbers are the entire point: this is where you find out whether the two
arms are pulling together or apart, and why a result did or did not survive.

Reading it: the vector arm should find topically related things the words miss,
the lexical arm should find vocabulary matches the model missed, and the panel
gets the intersection. A long AGREED list means retrieval is working. An empty
one means the corpus has nothing on this subject, which is frequently correct.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from pgvector.django import CosineDistance

from apps.ai_assistant import lexical
from apps.ai_assistant.models import CaseEmbedding, DisclosureLogEntryEmbedding
from apps.ai_assistant.retrieval import CANDIDATE_DEPTH, _case_vector
from apps.cases.models import Case
from apps.publications.models import DisclosureLogEntry


class Command(BaseCommand):
    help = "Show the vector arm, the lexical arm, and their agreement."

    def add_arguments(self, parser):
        parser.add_argument("case", help="Case ref (FOI-2026-0001) or numeric id.")
        parser.add_argument(
            "--depth",
            type=int,
            default=12,
            help="How many results to print per arm.",
        )

    def handle(self, *args, **options):
        case = self._resolve(options["case"])
        depth = options["depth"]

        self.stdout.write(f"{case.ref}: {(case.summary or case.request_text)[:100]}")

        vector = _case_vector(case)
        if vector is None:
            raise CommandError("This case has no embedding yet. Run embed_backlog.")

        lexemes = lexical.case_lexemes(case, table="publications_disclosurelogentry")
        self.stdout.write(f"distinctive lexemes: {lexemes[:12]}")
        self.stdout.write(
            f"AI_MAX_DISTANCE={settings.AI_MAX_DISTANCE} (vector backstop only)"
        )
        self.stdout.write("")

        self._entries(case, vector, lexemes, depth)
        self._cases(case, vector, depth)

    def _entries(self, case, vector, lexemes, depth):
        vec = list(
            DisclosureLogEntryEmbedding.objects.filter(
                entry__status=DisclosureLogEntry.Status.PUBLISHED
            )
            .exclude(entry__case=case)
            .annotate(distance=CosineDistance("request_vector", vector))
            .filter(distance__lte=settings.AI_MAX_DISTANCE)
            .select_related("entry")
            .order_by("distance")[:CANDIDATE_DEPTH]
        )
        lex = lexical.similar_published_entries(case, CANDIDATE_DEPTH)
        agreed = {row.entry_id for row in vec} & {entry.pk for entry in lex}

        self.stdout.write(self.style.MIGRATE_HEADING("PUBLISHED ENTRIES — vector arm"))
        for row in vec[:depth]:
            mark = "both" if row.entry_id in agreed else "  — "
            self.stdout.write(f"  {row.distance:.4f}  {mark}  {row.entry.title[:56]}")

        self.stdout.write(self.style.MIGRATE_HEADING("PUBLISHED ENTRIES — lexical arm"))
        if not lex:
            self.stdout.write("  (no distinctive vocabulary in common)")
        for entry in lex[:depth]:
            mark = "both" if entry.pk in agreed else "  — "
            self.stdout.write(f"  {entry.rank:.4f}  {mark}  {entry.title[:56]}")

        self.stdout.write(
            self.style.MIGRATE_HEADING(f"AGREED — {len(agreed)} shown on the panel")
        )
        if not agreed:
            self.stdout.write(
                self.style.WARNING(
                    "  (none — the panel is empty, which is correct when the "
                    "corpus holds nothing on this subject)"
                )
            )
        for entry in lex:
            if entry.pk in agreed:
                self.stdout.write(f"  {entry.title[:70]}")
        self.stdout.write("")

    def _cases(self, case, vector, depth):
        vec = list(
            CaseEmbedding.objects.exclude(case=case)
            .annotate(distance=CosineDistance("request_vector", vector))
            .filter(distance__lte=settings.AI_MAX_DISTANCE)
            .select_related("case")
            .order_by("distance")[:CANDIDATE_DEPTH]
        )
        lex = lexical.similar_cases(case, CANDIDATE_DEPTH)
        agreed = {row.case_id for row in vec} & {c.pk for c in lex}

        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"CASES — {len(agreed)} agreed of "
                f"{len(vec)} vector / {len(lex)} lexical"
            )
        )
        for c in lex[:depth]:
            if c.pk in agreed:
                self.stdout.write(f"  {c.ref}  {(c.summary or c.request_text)[:60]}")

    def _resolve(self, value):
        case = (
            Case.objects.filter(pk=value).first()
            if value.isdigit()
            else Case.objects.filter(ref__iexact=value).first()
        )
        if case is None:
            raise CommandError(f"No case matching {value!r}.")
        return case
