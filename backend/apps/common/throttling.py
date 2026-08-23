"""Rate limiting for the endpoints anonymous users can reach.

A plain package rather than a Django app: nothing here has models, admin or
migrations, so there is nothing for `INSTALLED_APPS` to register. Give it an
`apps.py` and add it there if that ever changes.

Two decisions apply to every public throttle in this project, and they are
recorded here so they are argued once rather than restated at each call site.

**Counted in the database, not in a cache.** There is no `CACHES` setting in
this project, so `django.core.cache` is the default LocMemCache: per-process,
and evictable at any time. A limit counted there would be a limit per gunicorn
worker, silently multiplied by the worker count, and it would reset itself
under memory pressure with nothing in the logs to say so. DRF's `AnonRateThrottle`
counts in exactly that cache, which is why it is unused here.

**No IP axis.** `SECURE_PROXY_SSL_HEADER` is unset, so behind the production
proxy `REMOTE_ADDR` is the proxy's own address on every request. An IP limit
would put every requester in a single bucket and throttle the whole public as
one person — worse than no limit, because it would look like it was working.
Adding an IP axis means configuring trusted proxies first, and then it should be
added to every caller here at once rather than one of them.

What this module deliberately does not decide is what a caller does when the
limit is hit. Those answers differ and are security-relevant in opposite
directions: the tracking endpoint must answer identically whether or not it
throttled, because a distinguishable response would turn it into a membership
oracle, while the request form must say plainly that it refused and point at
another way in, because silently dropping a request would interfere with a
statutory right. See each caller.
"""

from datetime import timedelta

from django.db.models import QuerySet
from django.utils import timezone


def exceeds_window_limits(
    queryset: QuerySet,
    timestamp_field: str,
    *,
    per_hour: int,
    per_day: int,
) -> bool:
    """Whether `queryset` holds too many rows in the last hour or day.

    `queryset` should already be narrowed to the subject being limited — one
    email address, usually. This only applies the time windows and the counts.

    The day window is filtered first and the hour counted within it, rather than
    running two independent counts against the full table. Where the timestamp
    column is indexed that keeps both counts working over a day of rows at most,
    which matters precisely when this is being called often — that is, under the
    traffic it exists to stop.
    """
    now = timezone.now()
    within_day = queryset.filter(**{f"{timestamp_field}__gte": now - timedelta(hours=24)})

    if within_day.count() >= per_day:
        return True

    within_hour = within_day.filter(
        **{f"{timestamp_field}__gte": now - timedelta(hours=1)}
    )
    return within_hour.count() >= per_hour
