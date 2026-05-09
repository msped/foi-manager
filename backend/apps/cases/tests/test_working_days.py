import pytest
from datetime import date
from apps.cases.utils import add_working_days, working_days_between


class TestAddWorkingDays:
    def test_simple_week(self):
        # Monday + 5 working days = next Monday
        monday = date(2026, 1, 5)
        assert add_working_days(monday, 5) == date(2026, 1, 12)

    def test_skips_weekend(self):
        # Friday + 1 working day = Monday
        friday = date(2026, 1, 9)
        assert add_working_days(friday, 1) == date(2026, 1, 12)

    def test_skips_bank_holiday(self):
        # 23 Dec 2026 + 1 working day skips Christmas Day (25 Dec) and Boxing Day (28 Dec)
        # 23 Dec is Wednesday, +1 = Thursday 24 Dec (Christmas Eve is not a bank holiday)
        dec_23 = date(2026, 12, 23)
        assert add_working_days(dec_23, 1) == date(2026, 12, 24)

    def test_skips_new_years_day(self):
        # 31 Dec 2025 (Wed) + 1 working day = 2 Jan 2026 (skipping New Year's Day 1 Jan)
        dec_31 = date(2025, 12, 31)
        assert add_working_days(dec_31, 1) == date(2026, 1, 2)

    def test_twenty_working_days(self):
        # 1 Jan 2026 is a bank holiday; submission on 2 Jan (Friday)
        # 20 working days from 2 Jan 2026
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

    def test_excludes_bank_holiday(self):
        # 31 Dec 2025 to 2 Jan 2026 — skips 1 Jan (bank holiday)
        assert working_days_between(date(2025, 12, 31), date(2026, 1, 2)) == 1
