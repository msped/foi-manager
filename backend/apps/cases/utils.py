from datetime import date, timedelta


def _get_bank_holiday_dates(jurisdiction: str) -> set:
    try:
        from django.apps import apps
        BankHoliday = apps.get_model('cases', 'BankHoliday')
        return set(BankHoliday.objects.filter(country=jurisdiction).values_list('date', flat=True))
    except Exception:
        return set()


def _is_working_day(d: date, bank_holidays: set) -> bool:
    return d.weekday() < 5 and d not in bank_holidays


def add_working_days(start: date, days: int) -> date:
    from django.conf import settings
    jurisdiction = getattr(settings, 'FOI_JURISDICTION', 'england')
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
    jurisdiction = getattr(settings, 'FOI_JURISDICTION', 'england')
    bank_holidays = _get_bank_holiday_dates(jurisdiction)
    count = 0
    current = start
    while current < end:
        current += timedelta(days=1)
        if _is_working_day(current, bank_holidays):
            count += 1
    return count
