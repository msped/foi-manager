"""Email-verified access for requesters checking their own FOI requests.

The access model is email only — no reference number. `Case._generate_ref()`
produces sequential refs, so a ref is guessable and never carried any security
weight, while asking for one loses every requester who mislaid it. Proving
control of the address the request was made from is the whole control.

Everything here treats the email address as user-supplied and untrusted right up
to the moment a code is successfully verified.
"""

import secrets
from datetime import timedelta

from django.core import signing
from django.utils import timezone

from apps.cases.models import Case
from apps.common.throttling import exceeds_window_limits

from .models import RequesterVerification, RequesterVerificationCode

#: Namespace for the session token signature, so a token minted here can never
#: be mistaken for one of Django's own signed values.
SESSION_SALT = "requester_portal.tracking"

#: How long a verified session lasts. FOI requesters are a population that uses
#: library and community-centre computers; an hour is long enough to read a
#: status page and short enough that walking away is survivable. The portal
#: offers an explicit "Finish" button for the same reason.
SESSION_MAX_AGE_SECONDS = 60 * 60


def normalise_email(email: str) -> str:
    """Lowercase and strip an address before it touches the code table.

    Load-bearing. `Case.requester_email` is stored exactly as typed, so without
    this a requester's throttle bucket is per capitalisation variant — which is
    to say, unlimited.
    """
    return (email or "").strip().lower()


def _generate_code() -> str:
    """Six digits, zero-padded, from the CSPRNG.

    `secrets.randbelow` rather than `random`, which is a Mersenne Twister and
    predictable from prior outputs. Codes rather than magic links because
    university and newsroom mail gateways prefetch links to scan them, burning a
    single-use token before the human has read the email.
    """
    return f"{secrets.randbelow(10**6):06d}"


def _prune(email: str) -> None:
    """Drop this address's expired ledger rows.

    Opportunistic because there is no Celery beat scheduler in this project —
    the worker runs tasks, nothing schedules them. Cleanup therefore has to ride
    along with the traffic that creates the rows.

    Only rows past RETENTION_HOURS go: the newer ones are still the throttle
    ledger, whether or not their codes are spent.
    """
    cutoff = timezone.now() - timedelta(hours=RequesterVerificationCode.RETENTION_HOURS)
    RequesterVerificationCode.objects.filter(
        email=email, created_at__lt=cutoff
    ).delete()


def is_throttled(email: str) -> bool:
    """Whether this address has asked for too many codes.

    The windows and the reasoning behind counting them in Postgres rather than a
    cache, and behind having no IP axis, live in `apps.common.throttling`. See
    RequesterVerificationCode for why a cache in particular cannot be trusted
    with the attempt counter this sits alongside.

    Callers must answer identically whether this returned True or False — see
    `issue_code`.
    """
    return exceeds_window_limits(
        RequesterVerificationCode.objects.filter(email=email),
        "created_at",
        per_hour=RequesterVerificationCode.THROTTLE_PER_HOUR,
        per_day=RequesterVerificationCode.THROTTLE_PER_DAY,
    )


def issue_code(email: str) -> str | None:
    """Issue a code for `email`, or return None if throttled.

    Callers must respond identically either way, and identically again for an
    address with no requests at all. A throttle message, a "no requests found"
    message or a slower response would each turn this endpoint into the
    membership oracle the design exists to avoid.
    """
    email = normalise_email(email)
    _prune(email)

    if is_throttled(email):
        return None

    now = timezone.now()
    # Invalidate anything outstanding by expiring it. Bringing the expiry
    # forward is exactly what invalidation means here, and it keeps the row in
    # place as a throttle ledger entry.
    RequesterVerificationCode.objects.filter(
        email=email, expires_at__gt=now, consumed_at__isnull=True
    ).update(expires_at=now)

    code = _generate_code()
    RequesterVerificationCode.objects.create(
        email=email,
        code=code,
        expires_at=now + timedelta(minutes=RequesterVerificationCode.TTL_MINUTES),
    )
    return code


def verify_code(email: str, code: str) -> bool:
    """Check a submitted code and, on success, consume it.

    The attempt counter lives on the code row, keyed by email, and nowhere else.
    The address travels through the portal in a hidden form field and is
    editable by whoever is sitting there, so a counter held in session or form
    state would reset itself on demand.
    """
    email = normalise_email(email)
    code = (code or "").strip()

    record = (
        RequesterVerificationCode.objects.filter(email=email)
        .order_by("-created_at")
        .first()
    )
    if record is None or not record.is_usable:
        return False

    # compare_digest, not ==, so a wrong guess cannot be narrowed down digit by
    # digit from how long the comparison took.
    if not secrets.compare_digest(record.code, code):
        record.attempts += 1
        if record.attempts >= RequesterVerificationCode.MAX_ATTEMPTS:
            # Destroy rather than lock: a spent code must not become a standing
            # hint that this address has requests worth guessing at.
            record.expires_at = timezone.now()
        record.save(update_fields=["attempts", "expires_at"])
        return False

    record.consumed_at = timezone.now()
    record.save(update_fields=["consumed_at"])

    RequesterVerification.objects.create(email=email)
    RequesterVerification.objects.filter(
        verified_at__lt=timezone.now()
        - timedelta(days=RequesterVerification.RETENTION_DAYS)
    ).delete()
    return True


def make_session_token(email: str) -> str:
    """Sign a token asserting nothing but the verified address.

    Signing is not encryption — the payload is readable by anyone holding the
    token — so it carries the email and no case data. The cases are looked up
    fresh on every request from that address, which also means a case closed or
    reassigned mid-session is reflected immediately rather than frozen into the
    token.
    """
    return signing.dumps({"email": normalise_email(email)}, salt=SESSION_SALT)


def read_session_token(token: str) -> str | None:
    """Return the verified email from a token, or None if it is bad or stale."""
    try:
        payload = signing.loads(
            token, salt=SESSION_SALT, max_age=SESSION_MAX_AGE_SECONDS
        )
    except signing.BadSignature:
        return None
    email = payload.get("email") if isinstance(payload, dict) else None
    return normalise_email(email) if email else None


def cases_for_email(email: str):
    """Every case belonging to a verified address, newest first.

    `__iexact` because `Case.requester_email` preserves the requester's own
    capitalisation, while everything on this side of the feature is lowercased.

    A shared mailbox that verifies once sees every request sent from it. That is
    an accepted consequence: the address is the identity, and an organisation
    that files under foi@ has chosen to pool its requests there.
    """
    return (
        Case.objects.filter(requester_email__iexact=normalise_email(email))
        .select_related("disclosure_log_entry")
        .order_by("-submitted_at")
    )
