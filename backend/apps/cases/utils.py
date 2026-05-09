from datetime import date, timedelta
import holidays


_UK_HOLIDAYS = holidays.country_holidays('GB', subdiv='ENG')


def _is_working_day(d: date) -> bool:
    return d.weekday() < 5 and d not in _UK_HOLIDAYS


def add_working_days(start: date, days: int) -> date:
    current = start
    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        if _is_working_day(current):
            remaining -= 1
    return current


def working_days_between(start: date, end: date) -> int:
    count = 0
    current = start
    while current < end:
        current += timedelta(days=1)
        if _is_working_day(current):
            count += 1
    return count
