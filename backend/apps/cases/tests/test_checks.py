from datetime import date

import pytest

from apps.cases.checks import bank_holidays_are_configured
from apps.cases.models import BankHoliday

pytestmark = pytest.mark.django_db


def ids(warnings):
    return [w.id for w in warnings]


def holiday(year, country=BankHoliday.Country.ENGLAND):
    return BankHoliday.objects.create(
        country=country, name=f"A holiday in {year}", date=date(year, 6, 1)
    )


@pytest.fixture
def england(settings):
    settings.FOI_JURISDICTION = "england"


class TestBankHolidaysAreConfigured:
    def test_warns_when_the_table_is_empty(self, england):
        assert ids(bank_holidays_are_configured(None)) == ["cases.W001"]

    def test_warns_when_only_another_jurisdiction_is_loaded(self, england):
        """A Scotland-only table is empty as far as an England service is
        concerned, and reads as configured to anyone glancing at the admin."""
        holiday(date.today().year, country=BankHoliday.Country.SCOTLAND)

        assert ids(bank_holidays_are_configured(None)) == ["cases.W001"]

    def test_warns_when_the_current_year_is_missing(self, england):
        """The table was loaded once and never topped up — the failure mode
        that actually happens, and the one an 'is it empty?' check misses."""
        holiday(date.today().year - 2)

        warnings = bank_holidays_are_configured(None)
        assert ids(warnings) == ["cases.W002"]
        assert str(date.today().year) in warnings[0].msg

    def test_silent_when_the_years_in_play_are_loaded(self, england):
        holiday(date.today().year)
        holiday(date.today().year + 1)

        assert bank_holidays_are_configured(None) == []

    def test_looks_into_next_year_from_late_in_this_one(self, england, monkeypatch):
        """A request made in December is due in January, so December is when a
        missing New Year's Day starts producing wrong deadlines — and the last
        moment anyone would think to check next year's table."""
        monkeypatch.setattr(
            "apps.cases.checks.timezone.localdate", lambda: date(2026, 12, 15)
        )
        holiday(2026)

        warnings = bank_holidays_are_configured(None)
        assert ids(warnings) == ["cases.W002"]
        assert "2027" in warnings[0].msg

    def test_ignores_next_year_early_in_this_one(self, england, monkeypatch):
        """Next year's dates are not always published yet, so warning about
        them in January would train people to ignore the warning."""
        monkeypatch.setattr(
            "apps.cases.checks.timezone.localdate", lambda: date(2026, 3, 1)
        )
        holiday(2026)

        assert bank_holidays_are_configured(None) == []

    def test_follows_the_configured_jurisdiction(self, settings):
        settings.FOI_JURISDICTION = "scotland"
        holiday(date.today().year, country=BankHoliday.Country.SCOTLAND)
        holiday(date.today().year + 1, country=BankHoliday.Country.SCOTLAND)

        assert bank_holidays_are_configured(None) == []
