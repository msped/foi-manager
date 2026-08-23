"""System checks for data this service calculates statutory deadlines from.

Registered as ordinary checks rather than under `Tags.database`, which plain
`manage.py check` skips. This has to be seen: the condition it reports produces
wrong deadlines quietly, and a warning nobody runs is no better than the
exception swallowing it replaced (see `utils._get_bank_holiday_dates`).
"""

from datetime import timedelta

from django.conf import settings
from django.core.checks import Warning, register
from django.utils import timezone

#: How far ahead a deadline can land, in calendar days.
#:
#: Twenty working days is about four calendar weeks; 45 leaves room for a run
#: of holidays and a paused clock. It exists so that from late in the year the
#: check also asks about next year, which is when it matters most — a December
#: request is due in January, and New Year's Day is exactly the holiday a
#: half-loaded table tends to be missing.
DEADLINE_HORIZON_DAYS = 45


def _years_in_play(today) -> set[int]:
    return {today.year, (today + timedelta(days=DEADLINE_HORIZON_DAYS)).year}


@register()
def bank_holidays_are_configured(app_configs, **kwargs):
    """Warn when deadlines are being calculated against no bank holiday data.

    An empty table is indistinguishable from a genuinely holiday-free period,
    so nothing downstream can detect this. The effect is that every statutory
    deadline is set earlier than the Act requires and cases are reported
    overdue before they are.

    A Warning rather than an Error on purpose: an Error fails `manage.py check`
    and would block the very `migrate` that creates the table this reads.
    """
    from django.apps import apps as django_apps
    from django.db import connection

    BankHoliday = django_apps.get_model("cases", "BankHoliday")

    # Before the first migrate the table does not exist. That is ordinary
    # setup, not a misconfiguration worth reporting.
    if BankHoliday._meta.db_table not in connection.introspection.table_names():
        return []

    jurisdiction = getattr(settings, "FOI_JURISDICTION", "england")
    holidays = BankHoliday.objects.filter(country=jurisdiction)

    if not holidays.exists():
        return [
            Warning(
                f"No bank holidays are recorded for FOI_JURISDICTION="
                f'"{jurisdiction}".',
                hint=(
                    "Statutory deadlines are calculated by skipping weekends "
                    "and bank holidays. With none recorded, every deadline "
                    "will be set earlier than the Freedom of Information Act "
                    "requires, and cases will be reported overdue before they "
                    "are. Load this jurisdiction's holidays before taking "
                    "requests."
                ),
                id="cases.W001",
            )
        ]

    missing = sorted(
        year
        for year in _years_in_play(timezone.localdate())
        if not holidays.filter(date__year=year).exists()
    )
    if missing:
        years = ", ".join(str(year) for year in missing)
        return [
            Warning(
                f"No bank holidays are recorded for {years} "
                f'(FOI_JURISDICTION="{jurisdiction}").',
                hint=(
                    "Deadlines falling in those years are being calculated as "
                    "though they contain no bank holidays, which sets them "
                    "earlier than the Act requires. Bank holiday dates are "
                    "published years ahead, so this is usually a table that "
                    "was loaded once and not topped up."
                ),
                id="cases.W002",
            )
        ]

    return []
