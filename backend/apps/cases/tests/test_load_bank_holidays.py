import json
from datetime import date
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.cases.models import BankHoliday

pytestmark = pytest.mark.django_db

FEED = {
    "england-and-wales": {
        "division": "england-and-wales",
        "events": [
            {"title": "New Year's Day", "date": "2026-01-01", "bunting": True},
            {"title": "Christmas Day", "date": "2026-12-25", "bunting": True},
        ],
    },
    "scotland": {
        "division": "scotland",
        "events": [{"title": "St Andrew's Day", "date": "2026-11-30", "bunting": True}],
    },
    "northern-ireland": {
        "division": "northern-ireland",
        "events": [
            {"title": "St Patrick's Day", "date": "2026-03-17", "bunting": True}
        ],
    },
}


@pytest.fixture
def feed_file(tmp_path):
    """Loads from disk so the suite never touches the network."""

    def write(payload=FEED):
        path = tmp_path / "bank-holidays.json"
        path.write_text(json.dumps(payload), encoding="utf-8")
        return str(path)

    return write


def run(path, **kwargs):
    out = StringIO()
    call_command("load_bank_holidays", file=path, stdout=out, **kwargs)
    return out.getvalue()


class TestLoading:
    def test_loads_every_division(self, feed_file):
        run(feed_file())

        assert BankHoliday.objects.filter(
            country=BankHoliday.Country.SCOTLAND, date=date(2026, 11, 30)
        ).exists()
        assert BankHoliday.objects.filter(
            country=BankHoliday.Country.NORTHERN_IRELAND, date=date(2026, 3, 17)
        ).exists()

    def test_england_and_wales_becomes_two_countries(self, feed_file):
        """GOV.UK publishes one division for both. Storing only England would
        leave a Welsh authority with an empty table and no warning that its
        deadlines were being calculated without holidays."""
        run(feed_file())

        for country in (BankHoliday.Country.ENGLAND, BankHoliday.Country.WALES):
            assert BankHoliday.objects.filter(
                country=country, date=date(2026, 1, 1)
            ).exists()

    def test_reports_what_it_did(self, feed_file):
        # Two England-and-Wales events across two countries, plus one each for
        # Scotland and Northern Ireland.
        assert "6 added" in run(feed_file())


class TestRerunning:
    def test_is_idempotent(self, feed_file):
        path = feed_file()
        run(path)
        output = run(path)

        assert BankHoliday.objects.count() == 6
        assert "0 added" in output
        assert "6 already current" in output

    def test_refreshes_a_renamed_holiday(self, feed_file):
        """Titles are revised — a substitute day gains its suffix — so a re-run
        should correct the name rather than leave the first one seen."""
        run(feed_file())

        renamed = json.loads(json.dumps(FEED))
        renamed["scotland"]["events"][0]["title"] = "St Andrew's Day (substitute day)"
        output = run(feed_file(renamed))

        assert "1 renamed" in output
        assert (
            BankHoliday.objects.get(
                country=BankHoliday.Country.SCOTLAND, date=date(2026, 11, 30)
            ).name
            == "St Andrew's Day (substitute day)"
        )

    def test_keeps_holidays_the_feed_no_longer_lists(self, feed_file):
        """The feed spans only a few years. Deleting anything outside it would
        remove the past holidays that already-issued deadlines were calculated
        from, silently changing what those deadlines should have been."""
        BankHoliday.objects.create(
            country=BankHoliday.Country.ENGLAND,
            name="New Year's Day",
            date=date(2019, 1, 1),
        )

        run(feed_file())

        assert BankHoliday.objects.filter(date=date(2019, 1, 1)).exists()


class TestDryRun:
    def test_writes_nothing(self, feed_file):
        output = run(feed_file(), dry_run=True)

        assert BankHoliday.objects.count() == 0
        assert "Dry run" in output
        assert "6 added" in output


class TestBadInput:
    def test_rejects_a_missing_division(self, feed_file):
        payload = json.loads(json.dumps(FEED))
        del payload["scotland"]

        with pytest.raises(CommandError, match="scotland"):
            run(feed_file(payload))

    def test_rejects_a_division_with_no_events(self, feed_file):
        """A feed that parses but carries nothing would otherwise report a
        clean run and leave the table exactly as broken as it was."""
        payload = json.loads(json.dumps(FEED))
        payload["scotland"]["events"] = []

        with pytest.raises(CommandError, match="no events"):
            run(feed_file(payload))

    def test_rejects_a_bad_date(self, feed_file):
        payload = json.loads(json.dumps(FEED))
        payload["scotland"]["events"][0]["date"] = "the 30th"

        with pytest.raises(CommandError, match="Bad date"):
            run(feed_file(payload))

    def test_rejects_a_missing_file(self, tmp_path):
        with pytest.raises(CommandError, match="Could not read"):
            run(str(tmp_path / "nope.json"))

    def test_nothing_is_written_when_input_is_rejected(self, feed_file):
        payload = json.loads(json.dumps(FEED))
        payload["northern-ireland"]["events"][0]["date"] = "not a date"

        with pytest.raises(CommandError):
            run(feed_file(payload))

        assert BankHoliday.objects.count() == 0
