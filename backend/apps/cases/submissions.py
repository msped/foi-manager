"""Abuse controls for the public request form.

`PublicCaseSubmitView` is the only endpoint in this project that writes a row
with no logged-in user behind it. Everywhere else volume is bounded by how many
staff accounts exist; here it is bounded by nothing, and every row it creates is
a statutory clock somebody has to close.

The counting ledger is the case table itself. Every portal submission creates
exactly one Case, so the cases already are the record of what was submitted and
when — a separate ledger model would be a second copy of that fact, free to
drift from it, and would need pruning of its own.

Windows, and why they are counted in Postgres with no IP axis, are in
`apps.common.throttling`.
"""

from apps.common.throttling import exceeds_window_limits

from .models import Case

#: Submissions accepted from one address per window.
#:
#: Set generously on purpose. This bounds automated volume; it is not a ration
#: on the statutory right. Section 8 does not cap how many requests a person may
#: make, and someone who genuinely needs a sixth in an hour is doing something
#: unusual rather than something they are not entitled to do. That is why
#: exceeding these limits points the requester at the FOI inbox instead of
#: refusing outright — the request stays makeable, it just stops being makeable
#: in bulk through a web form.
THROTTLE_PER_HOUR = 5
THROTTLE_PER_DAY = 20

#: Longest request text the form accepts.
#:
#: Note the tension with the frontend's reason for keeping check-answers on one
#: route: it avoided a cookie precisely so as not to impose an arbitrary ceiling
#: the Act does not impose. This is not that ceiling. Twenty thousand characters
#: is roughly three thousand words, far past any real request, and it exists so
#: one POST cannot carry a payload sized to hurt the database or the
#: acknowledgement email that quotes it back. Anyone with more to say than this
#: can send it to the FOI inbox, and the error message says so.
MAX_REQUEST_CHARS = 20_000


def normalise_email(email: str) -> str:
    """Lowercase and strip, so one address is one bucket.

    Load-bearing for the same reason it is in `requester_portal`:
    `Case.requester_email` keeps the requester's own capitalisation, so without
    this Foo@bar.com and foo@bar.com are throttled separately and the limit
    means nothing.
    """
    return (email or "").strip().lower()


def is_throttled(email: str) -> bool:
    """Whether this address has submitted too many requests recently.

    Unlike the tracking throttle, the caller must say plainly that it refused.
    Dropping a request silently would leave someone believing they had made one
    when no clock had started, which is a worse failure than making them use
    email.
    """
    return exceeds_window_limits(
        Case.objects.filter(
            received_by=Case.ReceivedBy.PORTAL,
            requester_email__iexact=normalise_email(email),
        ),
        "submitted_at",
        per_hour=THROTTLE_PER_HOUR,
        per_day=THROTTLE_PER_DAY,
    )
