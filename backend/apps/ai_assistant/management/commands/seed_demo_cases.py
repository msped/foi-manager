"""A corpus with known structure, for seeing whether retrieval actually works.

Three cases cannot tell you anything about a search feature. Nearest-neighbour
search always returns its nearest rows, so on a tiny corpus every request is
answered by whatever else exists, and the results look broken whether or not
they are.

This is not a random sample. It is built so that the right answer is known in
advance, which is what makes the output diagnostic rather than merely plausible:

* **Clusters** — several requests genuinely about one thing, worded as
  differently as real requesters word them. These should find each other.
* **Vocabulary traps** — requests that share salient words with a cluster while
  being about something else. Catering "for officers" against police officer
  misconduct is the trap that prompted this command; both are about officers and
  neither informs the other. Retrieval that cannot separate these is not usable.
* **Singletons** — requests with no relative in the corpus. The correct result is
  nothing at all, and a panel that shows something anyway is telling you the
  cutoff is too loose.
* **A refusal pair** — two requests refused on cost, years apart, so the s.12
  precedent path has something to find.

Synthetic on purpose. Real requests from WhatDoTheyKnow would carry real
requesters' personal data into a dev database for no gain, and would not contain
the traps, which are the part that does the work.

Everything is written with `@example.invalid` addresses — RFC 2606 reserves
`.invalid` precisely so it can never resolve — which is also how `--clear`
finds this data again without touching anything real.
"""

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.cases.models import Case, CaseExemption
from apps.publications.models import DisclosureLogEntry

#: Reserved by RFC 2606 — cannot resolve, and marks every row this command owns.
DEMO_DOMAIN = "@example.invalid"

#: (key, requester, days_ago, request_text, status, outcome, [exemptions], published?)
#:
#: `days_ago` spreads the corpus over four years, which also exercises the
#: deliberate absence of any date filter — the oldest cost refusal here is the
#: one a new cost refusal most wants to find.
CASES = [
    # ---- Cluster A: agency and temporary staffing spend -------------------
    (
        "agency-1",
        "j.okafor",
        420,
        "Please provide the total amount spent on agency staff in the 2023/24 "
        "financial year, broken down by department.",
        Case.Status.CLOSED,
        Case.Outcome.DISCLOSED_FULL,
        [],
        True,
    ),
    (
        "agency-2",
        "hlloyd",
        260,
        "I would like to know how much has been spent on temporary and agency "
        "workers over the last three financial years, and which agencies were "
        "used.",
        Case.Status.CLOSED,
        Case.Outcome.DISCLOSED_PART,
        [CaseExemption.Code.S43_COMMERCIAL],
        True,
    ),
    (
        "agency-3",
        "researchdesk",
        95,
        "Under the Freedom of Information Act please supply expenditure on "
        "locum and agency cover, including the amount paid to each supplier.",
        Case.Status.DRAFTING,
        "",
        [],
        False,
    ),
    # ---- Cluster B: police officer misconduct -----------------------------
    (
        "misconduct-1",
        "s.brennan",
        380,
        "How many police officers were subject to misconduct investigations in "
        "the last five years, and what was the outcome of each?",
        Case.Status.CLOSED,
        Case.Outcome.DISCLOSED_PART,
        [CaseExemption.Code.S40_PERSONAL_INFO],
        True,
    ),
    (
        "misconduct-2",
        "newsdesk.local",
        210,
        "Please provide the number of gross misconduct hearings held by the "
        "force, and how many resulted in dismissal without notice.",
        Case.Status.CLOSED,
        Case.Outcome.DISCLOSED_PART,
        [CaseExemption.Code.S40_PERSONAL_INFO],
        False,
    ),
    (
        "misconduct-3",
        "a.whitfield",
        60,
        "I request the number of complaints made against serving officers "
        "which were upheld, broken down by complaint category.",
        Case.Status.WITH_DEPARTMENT,
        "",
        [],
        False,
    ),
    # ---- Trap for cluster B: "officers", but about catering ---------------
    (
        "catering-trap",
        "b.nkemelu",
        150,
        "What is the annual spend on catering for officers and staff, including "
        "the staff restaurant and hospitality for meetings?",
        Case.Status.CLOSED,
        Case.Outcome.DISCLOSED_FULL,
        [],
        False,
    ),
    # ---- Trap for cluster A: "spend", but about vehicles ------------------
    (
        "fleet-trap",
        "m.donnelly",
        175,
        "Please provide the total spend on the vehicle fleet, including fuel, "
        "servicing and replacement purchases.",
        Case.Status.CLOSED,
        Case.Outcome.DISCLOSED_FULL,
        [],
        False,
    ),
    # ---- Cluster C: stop and search ---------------------------------------
    (
        "stopsearch-1",
        "c.adeyemi",
        320,
        "Stop and search figures for the last 12 months, broken down by "
        "ethnicity and by outcome.",
        Case.Status.CLOSED,
        Case.Outcome.DISCLOSED_FULL,
        [],
        True,
    ),
    (
        "stopsearch-2",
        "t.marchetti",
        110,
        "How many stop and search encounters resulted in an arrest, by month, "
        "for the most recent full year available?",
        Case.Status.REVIEW,
        "",
        [],
        False,
    ),
    # ---- Cluster D: consultancy spend -------------------------------------
    (
        "consultancy-1",
        "p.osei",
        500,
        "Details of all consultancy contracts awarded above £50,000 in the last "
        "two years, including the supplier and the value of each contract.",
        Case.Status.CLOSED,
        Case.Outcome.DISCLOSED_PART,
        [CaseExemption.Code.S43_COMMERCIAL],
        True,
    ),
    (
        "consultancy-2",
        "k.ferreira",
        140,
        "Please list the external consultants engaged by the authority, their "
        "daily rates, and the total paid to each.",
        Case.Status.WITH_DEPARTMENT,
        "",
        [],
        False,
    ),
    # ---- Cluster E: sickness absence --------------------------------------
    (
        "sickness-1",
        "unionrep.north",
        290,
        "How many working days were lost to sickness absence in each of the "
        "last three years, broken down by department?",
        Case.Status.CLOSED,
        Case.Outcome.DISCLOSED_FULL,
        [],
        False,
    ),
    (
        "sickness-2",
        "d.iqbal",
        75,
        "Sickness absence rates for the last three years, including how many "
        "absences were recorded as stress or mental health related.",
        Case.Status.ACKNOWLEDGED,
        "",
        [],
        False,
    ),
    # ---- Cluster F: cost refusals, four years apart -----------------------
    (
        "cost-refusal-old",
        "g.hargreaves",
        1400,
        "Please provide copies of all emails sent or received by the chief "
        "executive which mention the word 'restructure' at any point since "
        "2015.",
        Case.Status.EXEMPT,
        Case.Outcome.REFUSED,
        [CaseExemption.Code.S12_COST_LIMIT],
        False,
    ),
    (
        "cost-refusal-recent",
        "l.stavros",
        45,
        "I request all correspondence between the leader of the council and any "
        "property developer since 2018, including attachments.",
        Case.Status.EXEMPT,
        Case.Outcome.REFUSED,
        [CaseExemption.Code.S12_COST_LIMIT],
        False,
    ),
    # ---- Singletons: correct answer is nothing ----------------------------
    (
        "trees",
        "r.mbeki",
        200,
        "How many trees were felled in parks and open spaces managed by the "
        "authority last year, and how many were replanted?",
        Case.Status.CLOSED,
        Case.Outcome.DISCLOSED_FULL,
        [],
        False,
    ),
    (
        "pest-control",
        "v.szabo",
        130,
        "Please provide the number of pest control call-outs relating to rats "
        "in the last two years.",
        Case.Status.CLOSED,
        Case.Outcome.NOT_HELD,
        [],
        False,
    ),
    (
        "ripa",
        "civillibs.watch",
        240,
        "How many surveillance authorisations were granted under the Regulation "
        "of Investigatory Powers Act in the last three years?",
        Case.Status.CLOSED,
        Case.Outcome.REFUSED,
        [CaseExemption.Code.S31_LAW_ENFORCEMENT],
        False,
    ),
    (
        "cyber",
        "infosec.review",
        85,
        "Details of any ransomware or cyber security incidents affecting the "
        "authority in the past five years, including whether a ransom was paid.",
        Case.Status.EXEMPT,
        Case.Outcome.REFUSED,
        [CaseExemption.Code.S31_LAW_ENFORCEMENT],
        False,
    ),
]

#: Published responses, keyed to the case. Only a few — a disclosure log is
#: always smaller than the caseload behind it, and the panel should be tested
#: against that shape rather than one where every case happens to be published.
RESPONSES = {
    "agency-1": (
        "Agency staff expenditure 2023/24",
        "<p>The authority spent £4,182,600 on agency staff during the 2023/24 "
        "financial year. The breakdown by directorate is set out below.</p>"
        "<table><tr><th>Directorate</th><th>Spend</th></tr>"
        "<tr><td>Adult Social Care</td><td>£1,940,200</td></tr>"
        "<tr><td>Children's Services</td><td>£1,106,400</td></tr>"
        "<tr><td>Corporate Services</td><td>£612,000</td></tr>"
        "<tr><td>Place and Environment</td><td>£524,000</td></tr></table>"
        "<p>Figures are exclusive of VAT and include both agency and "
        "interim appointments.</p>",
    ),
    "agency-2": (
        "Temporary and agency worker spend, 2021/22 to 2023/24",
        "<p>Total expenditure on temporary and agency workers across the three "
        "financial years requested was £11,740,900.</p>"
        "<p>The names of individual supplying agencies and the rates agreed "
        "with each are withheld under section 43(2). Disclosure would be likely "
        "to prejudice the commercial interests of those suppliers and of the "
        "authority in future procurement. The public interest in transparency "
        "over the total sum is met by the figures above.</p>",
    ),
    "misconduct-1": (
        "Misconduct investigations and outcomes, five years",
        "<p>There were 218 misconduct investigations recorded over the period. "
        "Outcomes were: no case to answer 96; management action 71; written "
        "warning 28; final written warning 14; dismissal 9.</p>"
        "<p>Details which would identify individual officers are withheld under "
        "section 40(2), as disclosure would breach the data protection "
        "principles.</p>",
    ),
    "stopsearch-1": (
        "Stop and search by ethnicity and outcome",
        "<p>A total of 6,431 stop and search encounters were recorded in the "
        "period. The breakdown by self-defined ethnicity and by outcome is "
        "attached.</p><p>Of these, 1,204 resulted in an arrest and 892 in a "
        "community resolution or other disposal.</p>",
    ),
    "consultancy-1": (
        "Consultancy contracts over £50,000",
        "<p>Eleven consultancy contracts above the £50,000 threshold were "
        "awarded in the period, with a combined value of £2,760,000.</p>"
        "<p>Day rates for two contracts are withheld under section 43(2) where "
        "the supplier has demonstrated that disclosure would prejudice its "
        "position in ongoing competitive tendering.</p>",
    ),
}


class Command(BaseCommand):
    help = "Create a structured demo FOI corpus for testing retrieval quality."

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete the demo corpus and stop. Only touches @example.invalid rows.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Required to run with DEBUG off.",
        )

    def handle(self, *args, **options):
        # Real cases carry statutory obligations and real people's data. Writing
        # invented ones into a live service would corrupt both the disclosure
        # log and the transparency statistics, so this needs saying out loud.
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "DEBUG is off — this looks like a real environment. This "
                "command writes fictional cases and published responses. "
                "Re-run with --force only if you are certain."
            )

        if options["clear"]:
            self._clear()
            return

        existing = Case.objects.filter(requester_email__endswith=DEMO_DOMAIN).count()
        if existing:
            raise CommandError(
                f"{existing} demo case(s) already exist. Run with --clear first."
            )

        with transaction.atomic():
            created = self._create()

        self.stdout.write(self.style.SUCCESS(f"Created {created} case(s)."))
        self.stdout.write("")
        self.stdout.write("Next:")
        self.stdout.write("  make embed-backlog")
        self.stdout.write("  uv run python manage.py ai_inspect <ref> --all")
        self.stdout.write("")
        self.stdout.write(
            "Worth looking at specifically: the catering request should NOT "
            "rank against police misconduct, and the two cost refusals should "
            "find each other despite being nearly four years apart."
        )

    def _clear(self):
        cases = Case.objects.filter(requester_email__endswith=DEMO_DOMAIN)
        count = cases.count()
        # Cascades to exemptions, disclosure log entries and embeddings.
        cases.delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {count} demo case(s)."))

    def _create(self):
        now = timezone.now()
        by_key = {}

        for (
            key,
            requester,
            days_ago,
            text,
            status,
            outcome,
            exemptions,
            _published,
        ) in CASES:
            submitted = now - timedelta(days=days_ago)
            case = Case.objects.create(
                requester_name=requester.replace(".", " ").title(),
                requester_email=f"{requester}{DEMO_DOMAIN}",
                request_text=text,
                status=status,
                outcome=outcome,
                submitted_at=submitted,
                received_by=Case.ReceivedBy.PORTAL,
            )
            for code in exemptions:
                CaseExemption.objects.create(case=case, code=code)
            by_key[key] = case

        for key, (title, response_html) in RESPONSES.items():
            case = by_key[key]
            entry = DisclosureLogEntry.objects.create(
                case=case,
                title=title,
                # Mirrors how the real publish queue seeds this field: a
                # staff-reviewed, publication-safe copy of the request.
                summary=case.request_text,
                response_text=response_html,
                date_received=case.submitted_at.date(),
                date_responded=(case.submitted_at + timedelta(days=18)).date(),
                status=DisclosureLogEntry.Status.PUBLISHED,
                published_at=case.submitted_at + timedelta(days=18),
            )
            entry.exemptions.set(case.exemptions.all())

        return len(by_key)
