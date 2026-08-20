"""Requester-side identity for the public portal.

Neither model has a foreign key into `cases`, and that is the design rather than
an oversight. Access to a request is granted by proving control of the email
address the request was made from, so the email string is the join — see
`verification.cases_for_email`. A verified address that has no cases yet, or
whose cases are later deleted, is still a fact worth holding for its lifetime.
"""

from django.db import models
from django.utils import timezone


class RequesterVerificationCode(models.Model):
    """A one-time code emailed to a requester so they can see their own cases.

    A database table rather than a cache entry, for two reasons. The attempt
    counter below is the entire brute-force control over a six-digit secret, and
    a cache is permitted to evict any key at any time — an eviction would
    silently reset the counter and convert a five-attempt limit into an
    unlimited one, with nothing in the logs to say it happened. Separately,
    there is no CACHES setting in this project, so the default LocMemCache is
    per-process: codes would be issued by one gunicorn worker and verified by
    another, failing intermittently and only in production.

    Rows are also the throttle ledger — see `verification.is_throttled`. That is
    why they are kept for a day after use rather than deleted on consumption.

    The code is stored as issued. Hashing it would protect nothing that matters:
    anyone who can read this table can read `cases_case` too, and these codes
    grant strictly less than that.
    """

    #: Wrong guesses allowed before the code is destroyed.
    MAX_ATTEMPTS = 5
    #: How long a freshly issued code stays usable.
    TTL_MINUTES = 15
    #: Ledger rows older than this are pruned. Must stay >= the longest throttle
    #: window below, or the daily limit quietly stops being enforceable.
    RETENTION_HOURS = 24

    THROTTLE_PER_HOUR = 3
    THROTTLE_PER_DAY = 10

    #: Always lowercase. `Case.requester_email` is stored exactly as the
    #: requester typed it, so anything reaching this table must be normalised
    #: first — otherwise Foo@bar.com and foo@bar.com get a throttle bucket each,
    #: and the per-email limit, which is the only limit in v1, means nothing.
    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=6)
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["email", "-created_at"])]

    def __str__(self):
        return f"Verification code for {self.email} ({self.created_at:%Y-%m-%d %H:%M})"

    @property
    def is_usable(self) -> bool:
        return (
            self.consumed_at is None
            and self.attempts < self.MAX_ATTEMPTS
            and self.expires_at > timezone.now()
        )


class RequesterVerification(models.Model):
    """One row per successful verification, for the audit trail.

    Email-scoped, and deliberately not per case view. `CaseAuditEvent` is
    case-scoped, so logging views there would write a row per matching case
    every time someone loaded the page, burying the casework history under
    routine traffic. What is worth keeping is that this address proved control
    of itself at this time; which cases it then listed is reproducible from the
    address alone.
    """

    #: Twelve months. Long enough to answer "who accessed this?" during a
    #: complaint or ICO enquiry, short enough not to become a standing record of
    #: who has been asking us things.
    RETENTION_DAYS = 365

    email = models.EmailField(db_index=True)
    verified_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-verified_at"]

    def __str__(self):
        return f"{self.email} verified {self.verified_at:%Y-%m-%d %H:%M}"
