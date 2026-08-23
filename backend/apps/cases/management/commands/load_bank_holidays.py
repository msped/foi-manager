"""Load UK bank holidays from GOV.UK into the BankHoliday table.

Every statutory deadline in this service is calculated by skipping weekends and
the rows this command writes — all of them, from every UK nation. An empty or stale table does not fail — it
produces deadlines that are quietly too early — so `cases.W001`/`cases.W002`
warn about it and this is how you fix it.

Safe to re-run. Bank holidays are published years ahead, so the usual cadence is
once a year.
"""

import json
from datetime import date

import requests
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.cases.models import BankHoliday

GOVUK_URL = "https://www.gov.uk/bank-holidays.json"

#: GOV.UK publishes three divisions; this service stores four countries.
#:
#: Every nation's holidays count towards every deadline — section 10(6) counts
#: a bank holiday "in any part of the United Kingdom" — so all three divisions
#: must be loaded, not just the one the authority sits in. England and Wales
#: share a division and are stored separately anyway, so the table stays
#: readable and a future divergence between them would not be silent.
DIVISION_COUNTRIES = {
    "england-and-wales": [BankHoliday.Country.ENGLAND, BankHoliday.Country.WALES],
    "scotland": [BankHoliday.Country.SCOTLAND],
    "northern-ireland": [BankHoliday.Country.NORTHERN_IRELAND],
}

REQUEST_TIMEOUT_SECONDS = 30


class Command(BaseCommand):
    help = "Load UK bank holidays from GOV.UK (or a local JSON file)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            help=(
                "Read from a local copy of the GOV.UK JSON instead of "
                "fetching it. For hosts with no outbound internet access."
            ),
        )
        parser.add_argument(
            "--url",
            default=GOVUK_URL,
            help=f"Override the source URL (default: {GOVUK_URL}).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing anything.",
        )

    def handle(self, *args, **options):
        payload = self._load(options["file"], options["url"])
        divisions = self._parse(payload)

        created = updated = unchanged = 0

        with transaction.atomic():
            for division, events in divisions.items():
                for event in events:
                    for country in DIVISION_COUNTRIES[division]:
                        outcome = self._upsert(country, event)
                        if outcome == "created":
                            created += 1
                        elif outcome == "updated":
                            updated += 1
                        else:
                            unchanged += 1

            if options["dry_run"]:
                transaction.set_rollback(True)

        self._report(created, updated, unchanged, dry_run=options["dry_run"])

    def _load(self, path, url) -> dict:
        if path:
            try:
                with open(path, encoding="utf-8") as handle:
                    return json.load(handle)
            except OSError as exc:
                raise CommandError(f"Could not read {path}: {exc}") from exc
            except json.JSONDecodeError as exc:
                raise CommandError(f"{path} is not valid JSON: {exc}") from exc

        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            raise CommandError(
                f"Could not fetch {url}: {exc}. If this host has no outbound "
                "internet access, download the file elsewhere and pass --file."
            ) from exc
        except json.JSONDecodeError as exc:
            raise CommandError(f"{url} did not return valid JSON: {exc}") from exc

    def _parse(self, payload) -> dict[str, list[dict]]:
        """Pull the events out, failing loudly if the feed is not what we expect.

        Checked rather than trusted because a silently empty result here looks
        exactly like a successful run that had nothing to do, and would leave
        the table in the state this command exists to fix.
        """
        if not isinstance(payload, dict):
            raise CommandError("Expected a JSON object at the top level.")

        missing = [d for d in DIVISION_COUNTRIES if d not in payload]
        if missing:
            raise CommandError(
                f"Source is missing expected division(s): {', '.join(missing)}. "
                f"Found: {', '.join(sorted(payload)) or 'nothing'}."
            )

        divisions = {}
        for division in DIVISION_COUNTRIES:
            events = (payload[division] or {}).get("events")
            if not events:
                raise CommandError(f'Division "{division}" contains no events.')
            divisions[division] = events
        return divisions

    def _upsert(self, country, event) -> str:
        try:
            event_date = date.fromisoformat(event["date"])
            title = event["title"]
        except (KeyError, TypeError) as exc:
            raise CommandError(f"Malformed event {event!r}: {exc}") from exc
        except ValueError as exc:
            raise CommandError(f"Bad date in event {event!r}: {exc}") from exc

        existing = BankHoliday.objects.filter(country=country, date=event_date).first()
        if existing is None:
            BankHoliday.objects.create(country=country, date=event_date, name=title)
            return "created"

        # Titles do get revised — a substitute day gains its "(substitute day)"
        # suffix, for instance — so the name is refreshed rather than left as
        # first seen. The date and country are the identity and never change.
        if existing.name != title:
            existing.name = title
            existing.save(update_fields=["name"])
            return "updated"

        return "unchanged"

    def _report(self, created, updated, unchanged, *, dry_run):
        summary = (
            f"{created} added, {updated} renamed, {unchanged} already current."
        )
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f"Dry run — nothing written. Would be: {summary}")
            )
            return

        self.stdout.write(self.style.SUCCESS(summary))

        # Deliberately additive. The feed only spans a few years either side of
        # now, so removing anything absent from it would delete the past
        # holidays that already-issued deadlines were calculated from.
        years = BankHoliday.objects.dates("date", "year")
        if years:
            self.stdout.write(
                f"Table now covers {years[0].year}–{years[len(years) - 1].year}."
            )
