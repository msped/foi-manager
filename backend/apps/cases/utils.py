from datetime import date, timedelta


def _get_bank_holiday_dates(jurisdiction: str) -> set:
    """Bank holiday dates for a jurisdiction.

    Deliberately undefended. This used to wrap the query in
    `except Exception: return set()`, so any database problem produced a
    deadline calculated as though no bank holiday existed — several days
    earlier than the Act allows, written onto the case by `Case.save()`, and
    logged nowhere. Nothing downstream could tell that date apart from a
    correct one.

    A statutory deadline that is quietly wrong is worse than a request that
    fails outright. The failure is visible and the user retries; the wrong date
    is neither, and it is the one number the Act actually counts.

    Every caller runs inside a request or a model save with the database
    already in use, so an exception here is a real fault rather than a
    condition to paper over. `apps.get_model` rather than a module-level
    import because `models.py` imports this module.
    """
    from django.apps import apps

    BankHoliday = apps.get_model("cases", "BankHoliday")
    return set(
        BankHoliday.objects.filter(country=jurisdiction).values_list("date", flat=True)
    )


def _is_working_day(d: date, bank_holidays: set) -> bool:
    return d.weekday() < 5 and d not in bank_holidays


def add_working_days(start: date, days: int) -> date:
    from django.conf import settings

    jurisdiction = getattr(settings, "FOI_JURISDICTION", "england")
    bank_holidays = _get_bank_holiday_dates(jurisdiction)
    current = start
    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        if _is_working_day(current, bank_holidays):
            remaining -= 1
    return current


def working_days_between(start: date, end: date) -> int:
    from django.conf import settings

    jurisdiction = getattr(settings, "FOI_JURISDICTION", "england")
    bank_holidays = _get_bank_holiday_dates(jurisdiction)
    count = 0
    current = start
    while current < end:
        current += timedelta(days=1)
        if _is_working_day(current, bank_holidays):
            count += 1
    return count
