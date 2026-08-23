from datetime import date

import pytest
from django.db import DatabaseError

from apps.cases.models import BankHoliday
from apps.cases.utils import add_working_days, working_days_between

# Every test here needs the database, including the ones that only step over
# weekends: `add_working_days` reads the bank holiday table on every call, so a
# test without database access is not testing pure date arithmetic — it is
# testing what happens when the lookup fails. That distinction used to be
# invisible, because the lookup swallowed its own errors and returned no
# holidays, which is exactly how the two tests below came to pass while
# asserting the opposite of what they claimed.
pytestmark = pytest.mark.django_db


@pytest.fixture
def bank_holidays():
    """The England holidays these tests reason about.

    A test that names a holiday must ask for this, or it is asserting against
    an empty table.
    """
    BankHoliday.objects.bulk_create(
        [
            BankHoliday(
                country=BankHoliday.Country.ENGLAND,
                name="New Year's Day",
                date=date(2026, 1, 1),
            ),
            BankHoliday(
                country=BankHoliday.Country.ENGLAND,
                name="Christmas Day",
                date=date(2026, 12, 25),
            ),
            # 26 December 2026 is a Saturday, so Boxing Day is substituted to
            # the following Monday.
            BankHoliday(
                country=BankHoliday.Country.ENGLAND,
                name="Boxing Day (substitute day)",
                date=date(2026, 12, 28),
            ),
        ]
    )


class TestAddWorkingDays:
    def test_simple_week(self):
        # Monday + 5 working days = next Monday
        monday = date(2026, 1, 5)
        assert add_working_days(monday, 5) == date(2026, 1, 12)

    def test_skips_weekend(self):
        # Friday + 1 working day = Monday
        friday = date(2026, 1, 9)
        assert add_working_days(friday, 1) == date(2026, 1, 12)

    def test_skips_bank_holiday(self, bank_holidays):
        # Thursday 24 Dec 2026 + 1 working day. Christmas Day (Fri 25th) is a
        # holiday, the 26th and 27th are the weekend, and Boxing Day is
        # substituted to Mon 28th — so the next working day is Tue 29th.
        #
        # This previously started from 23 Dec and expected 24 Dec, which is a
        # plain weekday step over no holiday at all: it passed whether or not
        # any holiday was configured.
        assert add_working_days(date(2026, 12, 24), 1) == date(2026, 12, 29)

    def test_skips_new_years_day(self, bank_holidays):
        # 31 Dec 2025 (Wed) + 1 working day = 2 Jan 2026 (skipping New Year's Day 1 Jan)
        dec_31 = date(2025, 12, 31)
        assert add_working_days(dec_31, 1) == date(2026, 1, 2)

    def test_twenty_working_days(self, bank_holidays):
        # Submission on Friday 2 Jan 2026, the day after New Year's Day.
        jan_2 = date(2026, 1, 2)
        result = add_working_days(jan_2, 20)
        assert result == date(2026, 1, 30)

    def test_zero_days(self):
        monday = date(2026, 1, 5)
        assert add_working_days(monday, 0) == monday


class TestWorkingDaysBetween:
    def test_same_day(self):
        d = date(2026, 1, 5)
        assert working_days_between(d, d) == 0

    def test_one_week(self):
        assert working_days_between(date(2026, 1, 5), date(2026, 1, 12)) == 5

    def test_excludes_weekend(self):
        # Mon to Mon = 5 working days
        assert working_days_between(date(2026, 1, 5), date(2026, 1, 9)) == 4

    def test_excludes_bank_holiday(self, bank_holidays):
        # 31 Dec 2025 to 2 Jan 2026 — skips 1 Jan (bank holiday)
        assert working_days_between(date(2025, 12, 31), date(2026, 1, 2)) == 1


class TestLookupFailure:
    def test_a_failed_lookup_is_not_swallowed(self, monkeypatch):
        """A database fault must reach the caller.

        `_get_bank_holiday_dates` used to catch every exception and return an
        empty set, so a fault here produced a deadline calculated as though no
        bank holiday existed — earlier than the Act allows, saved onto the case,
        and indistinguishable afterwards from a correct one. Raising is the
        point: the save fails, and nobody is handed a wrong statutory date.
        """

        def boom(*args, **kwargs):
            raise DatabaseError("connection lost")

        monkeypatch.setattr(BankHoliday.objects, "values_list", boom)

        with pytest.raises(DatabaseError):
            add_working_days(date(2026, 12, 24), 1)


class TestAllNationsCount:
    """Section 10(6) counts a bank holiday "in any part of the United Kingdom",
    so a holiday observed in only one nation stops the clock everywhere.

    These previously asserted the opposite — that a Scottish holiday was
    ignored unless the service was configured as Scottish — which set deadlines
    earlier than the Act allows for every authority outside Scotland."""

    def test_a_scotland_only_holiday_stops_the_clock(self):
        BankHoliday.objects.create(
            country=BankHoliday.Country.SCOTLAND,
            name="St Andrew's Day",
            date=date(2026, 11, 30),
        )

        # Friday 27 Nov 2026 + 1 working day would be Monday 30 Nov, but that
        # Monday is a bank holiday in Scotland, so it is Tuesday everywhere.
        assert add_working_days(date(2026, 11, 27), 1) == date(2026, 12, 1)

    def test_a_northern_ireland_only_holiday_stops_the_clock(self):
        BankHoliday.objects.create(
            country=BankHoliday.Country.NORTHERN_IRELAND,
            name="Battle of the Boyne",
            date=date(2026, 7, 13),
        )

        # Friday 10 July 2026 + 1 working day skips Monday the 13th.
        assert add_working_days(date(2026, 7, 10), 1) == date(2026, 7, 14)

    def test_the_same_date_in_two_nations_is_counted_once(self):
        """The union is a set of dates, so Christmas Day appearing under every
        nation must not consume the clock several times over."""
        for country in (
            BankHoliday.Country.ENGLAND,
            BankHoliday.Country.WALES,
            BankHoliday.Country.SCOTLAND,
        ):
            BankHoliday.objects.create(
                country=country, name="Christmas Day", date=date(2026, 12, 25)
            )

        # Thursday 24 Dec 2026 + 1 working day skips Friday the 25th and the
        # weekend, landing on Monday the 28th.
        assert add_working_days(date(2026, 12, 24), 1) == date(2026, 12, 28)
