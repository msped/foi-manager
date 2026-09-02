"""Import published FOI responses from a directory of disclosure-log PDFs.

Development tooling, for calibrating retrieval against real requests rather
than the twenty I invented in `seed_demo_cases`.

Written against Cumbria Constabulary's published disclosure log, whose PDFs are
a rigidly consistent letter template — which is what makes parsing them honest
rather than a guess:

    FREEDOM OF INFORMATION REQUEST - FOI 117/26 Failure to Appear Warrants
    I refer to your request ... received by Cumbria Constabulary on 28th
    January 2026. I note you seek access to the following information:
        <the request>
    Your request for information has now been considered, and ...
        <the response>
    Complaint Rights
        <boilerplate, discarded>

Other forces use other templates. The markers below are the whole of the
force-specific knowledge, so pointing this at another force means editing them
and nothing else.

**Uses `pdftotext -layout`, never plain `pdftotext`.** Without `-layout` a table
comes out one cell per line — `Year / Right to ask applications / 2015 / 10` —
which embeds as meaningless tokens. This is the same failure as `strip_tags`
turning `<td>500</td><td>Agency</td>` into `500Agency`, and it matters for the
same reason: the tabular answers are exactly the ones worth finding.

Deliberately outside the app's dependencies. `pdftotext` (poppler) is called as
a subprocess, so nothing is added to `requirements/`, and the extraction stays a
development step rather than becoming something the service ships.

On personal data: this force redacts the requester before publishing — the
letters open with a bare "Dear". Synthetic requesters are generated anyway, so
that a template which one day is not redacted still cannot put a real person
into the database.
"""

import re
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.cases.models import Case, CaseExemption
from apps.publications.models import DisclosureLogEntry

from .seed_demo_cases import DEMO_DOMAIN

# Whitespace is `\s+` throughout: pdftotext wraps at the page width, so any of
# these markers can be split across a line break.
RE_HEADING = re.compile(
    r"FREEDOM\s+OF\s+INFORMATION\s+REQUEST\s*[-–—]\s*FOI\s*(\d+\s*/\s*\d+)\s*(.*?)"
    r"(?=I\s+refer\s+to\s+your\s+request)",
    re.IGNORECASE | re.DOTALL,
)
RE_RECEIVED = re.compile(
    r"received\s+by\s+.{0,60}?\s+on\s+(\d{1,2}\s*(?:st|nd|rd|th)?\s+\w+\s+\d{4})",
    re.IGNORECASE | re.DOTALL,
)
RE_REQUEST = re.compile(
    r"seek\s+access\s+to\s+the\s+following\s+information\s*:?\s*(.*?)"
    r"(?=Your\s+request\s+for\s+information\s+has\s+now\s+been\s+considered)",
    re.IGNORECASE | re.DOTALL,
)
RE_RESPONSE = re.compile(
    r"(Your\s+request\s+for\s+information\s+has\s+now\s+been\s+considered.*?)"
    r"(?=Complaint\s+Rights)",
    re.IGNORECASE | re.DOTALL,
)
RE_ANY_DATE = re.compile(r"(\d{1,2}\s*(?:st|nd|rd|th)?\s+\w+\s+\d{4})")

#: Only sections that are actually exemptions. The refusal letters also cite
#: s.16 (advice and assistance), s.17 (refusal notice) and s.50 (complaints to
#: the Commissioner), none of which is a reason for withholding anything —
#: recording them as exemptions would corrupt the frequency counts the panel
#: reports. Filtering against the model's own codes excludes them for free.
RE_SECTION = re.compile(r"[Ss]ection\s+(\d{1,2})", re.MULTILINE)
VALID_CODES = {code for code, _ in CaseExemption.Code.choices}

RE_ORDINAL = re.compile(r"(\d{1,2})\s*(?:st|nd|rd|th)", re.IGNORECASE)
RE_WS = re.compile(r"[ \t]+")
RE_BLANK = re.compile(r"\n{3,}")

#: Around a quarter of these letters put the subject on its own line rather than
#: after the reference, leaving the heading capture empty. The filename carries
#: the same subject as a slug — `foi-139_26-clares-law-disclosures.pdf` — so it
#: is a better fallback than leaving the title blank.
RE_FILENAME = re.compile(r"^foi[-_]?\d+[-_]\d+[-_](.+)$", re.IGNORECASE)


class Command(BaseCommand):
    help = "Import published FOI responses from a directory of PDFs."

    def add_arguments(self, parser):
        parser.add_argument("directory", help="Directory containing the PDFs.")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Parse and report without writing. Run this first.",
        )
        parser.add_argument(
            "--force", action="store_true", help="Required to run with DEBUG off."
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "DEBUG is off — this looks like a real environment. These are "
                "another authority's cases and would corrupt both the "
                "disclosure log and the transparency statistics."
            )
        if not shutil.which("pdftotext"):
            raise CommandError(
                "pdftotext not found. It ships with poppler: `brew install poppler`."
            )

        directory = Path(options["directory"]).expanduser()
        if not directory.is_dir():
            raise CommandError(f"{directory} is not a directory.")

        pdfs = sorted(directory.glob("*.pdf"))
        if not pdfs:
            raise CommandError(f"No PDFs in {directory}.")

        parsed, skipped = [], []
        for path in pdfs:
            record = self._parse(path)
            (parsed if record else skipped).append(record or path.name)

        self.stdout.write(f"{len(parsed)} parsed, {len(skipped)} skipped.")
        for name in skipped:
            self.stdout.write(self.style.WARNING(f"  skipped {name}"))

        counts = {}
        for record in parsed:
            counts[record["outcome"] or "(none)"] = (
                counts.get(record["outcome"] or "(none)", 0) + 1
            )
        for label, count in sorted(counts.items(), key=lambda kv: -kv[1]):
            self.stdout.write(f"  {count:4}  {label}")

        if options["dry_run"]:
            for record in parsed[:3]:
                self.stdout.write("")
                self.stdout.write(self.style.MIGRATE_HEADING(record["ref"]))
                self.stdout.write(f"  title:      {record['title']}")
                self.stdout.write(f"  received:   {record['received']}")
                self.stdout.write(f"  outcome:    {record['outcome'] or '(none)'}")
                self.stdout.write(f"  exemptions: {record['exemptions'] or '(none)'}")
                self.stdout.write(f"  request:    {record['request'][:200]}…")
                self.stdout.write(f"  response:   {record['response'][:200]}…")
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Dry run — nothing written."))
            return

        with transaction.atomic():
            created = self._create(parsed)

        self.stdout.write(self.style.SUCCESS(f"Imported {created} case(s)."))
        self.stdout.write("")
        self.stdout.write("Next:  make embed-backlog")

    def _parse(self, path):
        try:
            text = subprocess.run(
                ["pdftotext", "-layout", str(path), "-"],
                capture_output=True,
                text=True,
                timeout=60,
                check=True,
            ).stdout
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            return None

        heading = RE_HEADING.search(text)
        request = RE_REQUEST.search(text)
        if not heading or not request:
            # A letter that does not follow the template. Reported rather than
            # guessed at — a half-parsed case is worse than an absent one.
            return None

        request_text = self._tidy(request.group(1))
        if not request_text:
            return None

        response_match = RE_RESPONSE.search(text)
        response = self._tidy(response_match.group(1)) if response_match else ""

        received = RE_RECEIVED.search(text)
        responded = RE_ANY_DATE.search(text)

        title = self._tidy(heading.group(2)).replace("\n", " ")[:400]

        return {
            "ref": "FOI " + re.sub(r"\s+", "", heading.group(1)),
            "title": title or self._title_from_filename(path),
            "request": request_text,
            "response": response,
            "received": self._date(received.group(1)) if received else None,
            "responded": self._date(responded.group(1)) if responded else None,
            "exemptions": self._exemptions(response),
            "outcome": self._outcome(response),
        }

    def _title_from_filename(self, path):
        match = RE_FILENAME.match(path.stem)
        slug = match.group(1) if match else path.stem
        # Trailing hyphens are common in these filenames, and title-casing is
        # only cosmetic — the value is never embedded on its own.
        return slug.replace("-", " ").replace("_", " ").strip().title()[:400]

    def _tidy(self, value):
        """Collapse runs of spaces without touching newlines.

        Line structure is what keeps a table readable, so only horizontal
        whitespace is squeezed — `-layout` pads cells with long runs of spaces.
        """
        return RE_BLANK.sub("\n\n", RE_WS.sub(" ", value)).strip()

    def _date(self, value):
        cleaned = RE_ORDINAL.sub(r"\1", RE_WS.sub(" ", value)).strip()
        for fmt in ("%d %B %Y", "%d %b %Y"):
            try:
                return timezone.make_aware(datetime.strptime(cleaned, fmt))
            except ValueError:
                continue
        return None

    def _exemptions(self, response):
        codes = {f"s{n}" for n in RE_SECTION.findall(response)}
        return sorted(codes & VALID_CODES)

    def _outcome(self, response):
        """Read the decision off the letter's own wording.

        Order matters. A cost refusal says the information "is not held in an
        easily retrievable format", which reads as "not held" to a naive match
        while being nothing of the sort — so the explicit refusal notice is
        checked first.
        """
        lowered = response.lower()
        if "refusal notice" in lowered or "not obliged to disclose" in lowered:
            return Case.Outcome.REFUSED
        if "does not hold" in lowered or "do not hold" in lowered:
            return Case.Outcome.NOT_HELD
        if "disclose" in lowered:
            # Anything withheld alongside a disclosure makes it partial.
            return (
                Case.Outcome.DISCLOSED_PART
                if self._exemptions(response)
                else Case.Outcome.DISCLOSED_FULL
            )
        return ""

    def _create(self, records):
        now = timezone.now()
        created = 0

        for index, record in enumerate(records):
            submitted = record["received"] or (now - timedelta(days=30 * (index + 1)))
            outcome = record["outcome"]
            status = (
                Case.Status.EXEMPT
                if outcome == Case.Outcome.REFUSED
                else Case.Status.CLOSED
                if outcome
                else Case.Status.NEW
            )

            case = Case.objects.create(
                # Generated. These letters are published with the requester
                # already redacted; this makes that independent of the template.
                requester_name=f"Imported Requester {index + 1}",
                requester_email=f"imported-{index + 1}{DEMO_DOMAIN}",
                request_text=record["request"],
                summary=record["title"],
                status=status,
                outcome=outcome,
                submitted_at=submitted,
                received_by=Case.ReceivedBy.EMAIL,
            )
            for code in record["exemptions"]:
                CaseExemption.objects.create(case=case, code=code)

            if record["response"]:
                responded = record["responded"] or (submitted + timedelta(days=18))
                entry = DisclosureLogEntry.objects.create(
                    case=case,
                    title=record["title"] or record["ref"],
                    # Mirrors the publish queue, which seeds this from the
                    # request text as a staff-reviewed, publishable summary.
                    summary=record["request"],
                    response_text=record["response"],
                    date_received=submitted.date(),
                    date_responded=responded.date(),
                    status=DisclosureLogEntry.Status.PUBLISHED,
                    published_at=responded,
                )
                entry.exemptions.set(case.exemptions.all())

            created += 1

        return created
