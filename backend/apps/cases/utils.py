from datetime import date, timedelta


def _get_bank_holiday_dates() -> set:
    """Every UK bank holiday, whichever nation observes it.

    Not filtered to one nation, and that is the statute rather than a
    simplification. Section 10(6) defines a working day as excluding "a day
    which is a bank holiday under the Banking and Financial Dealings Act 1971
    in any part of the United Kingdom" — so 2 January and St Andrew's Day stop
    the clock for an authority in Cornwall exactly as they do for one in
    Aberdeen, and the Battle of the Boyne stops it for both.

    This used to filter on `FOI_JURISDICTION`, which counted the other nations'
    holidays as ordinary working days and set deadlines earlier than the Act
    allows. Loading the full GOV.UK feed is therefore not optional: a table
    holding only England and Wales is a table that calculates the wrong dates.

    Deliberately undefended. This also used to wrap the query in
    `except Exception: return set()`, so any database problem produced a
    deadline calculated as though no bank holiday existed, written onto the
    case by `Case.save()` and logged nowhere. A statutory deadline that is
    quietly wrong is worse than a request that fails outright: the failure is
    visible and the user retries; the wrong date is neither, and it is the one
    number the Act actually counts.

    Every caller runs inside a request or a model save with the database
    already in use, so an exception here is a real fault rather than a
    condition to paper over. `apps.get_model` rather than a module-level
    import because `models.py` imports this module.
    """
    from django.apps import apps

    BankHoliday = apps.get_model("cases", "BankHoliday")
    return set(BankHoliday.objects.values_list("date", flat=True))


def _is_working_day(d: date, bank_holidays: set) -> bool:
    return d.weekday() < 5 and d not in bank_holidays


def add_working_days(start: date, days: int) -> date:
    bank_holidays = _get_bank_holiday_dates()
    current = start
    remaining = days
    while remaining > 0:
        current += timedelta(days=1)
        if _is_working_day(current, bank_holidays):
            remaining -= 1
    return current


def working_days_between(start: date, end: date) -> int:
    bank_holidays = _get_bank_holiday_dates()
    count = 0
    current = start
    while current < end:
        current += timedelta(days=1)
        if _is_working_day(current, bank_holidays):
            count += 1
    return count
