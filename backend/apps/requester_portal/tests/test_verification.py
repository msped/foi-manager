"""Unit tests for the access model.

Weighted towards the two invariants that fail silently: the attempt counter
living on the database row, and addresses being lowercased before they reach it.
Both keep working "fine" when broken — the throttle simply stops throttling and
nothing errors — so they are tested directly rather than through the views.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.requester_portal.models import (
    RequesterVerification,
    RequesterVerificationCode,
)
from apps.requester_portal.verification import (
    cases_for_email,
    is_throttled,
    issue_code,
    make_session_token,
    normalise_email,
    read_session_token,
    verify_code,
)

pytestmark = pytest.mark.django_db


class TestCodeIssuing:
    def test_issues_a_six_digit_code(self):
        code = issue_code("someone@example.com")
        assert code is not None
        assert len(code) == 6
        assert code.isdigit()

    def test_stores_the_address_lowercased(self):
        issue_code("Someone@Example.COM")
        assert RequesterVerificationCode.objects.get().email == "someone@example.com"

    def test_new_code_invalidates_the_previous_one(self):
        first = issue_code("someone@example.com")
        issue_code("someone@example.com")

        assert verify_code("someone@example.com", first) is False

    def test_expired_code_is_rejected(self):
        code = issue_code("someone@example.com")
        RequesterVerificationCode.objects.update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        assert verify_code("someone@example.com", code) is False

    def test_code_is_single_use(self):
        code = issue_code("someone@example.com")

        assert verify_code("someone@example.com", code) is True
        assert verify_code("someone@example.com", code) is False


class TestAttemptLimit:
    """Invariant 1: the counter lives on the code row, keyed by email."""

    def test_code_dies_after_five_wrong_guesses(self):
        code = issue_code("someone@example.com")

        for _ in range(RequesterVerificationCode.MAX_ATTEMPTS):
            assert verify_code("someone@example.com", "000000") is False

        # Even the correct code no longer works — the code is destroyed, not
        # merely locked for a while.
        assert verify_code("someone@example.com", code) is False

    def test_counter_survives_a_caller_that_forgets_it(self):
        """The address arrives in a hidden form field the user can edit, so the
        counter must not be resettable by anything the caller controls. Every
        call below is independent and stateless, exactly as the views are."""
        code = issue_code("someone@example.com")

        for _ in range(4):
            verify_code("someone@example.com", "000000")

        assert RequesterVerificationCode.objects.get().attempts == 4
        # A fifth wrong guess exhausts it regardless of how the caller behaved.
        assert verify_code("someone@example.com", "999999") is False
        assert verify_code("someone@example.com", code) is False


class TestThrottle:
    def test_allows_up_to_the_hourly_limit(self):
        for _ in range(RequesterVerificationCode.THROTTLE_PER_HOUR):
            assert issue_code("someone@example.com") is not None

        assert issue_code("someone@example.com") is None

    def test_case_variants_share_one_bucket(self):
        """Invariant 2. Without normalisation each capitalisation would get its
        own bucket, and the per-email limit is the only limit in v1."""
        for spelling in (
            "someone@example.com",
            "SOMEONE@example.com",
            "SomeOne@Example.com",
        ):
            issue_code(spelling)

        assert is_throttled("someone@example.com") is True
        assert issue_code("sOmEoNe@ExAmPlE.cOm") is None

    def test_daily_limit_applies_beyond_the_hourly_window(self):
        email = "someone@example.com"
        # Age the hourly window out from under the ledger, leaving the rows
        # inside the 24-hour one.
        for _ in range(RequesterVerificationCode.THROTTLE_PER_DAY):
            issue_code(email)
            RequesterVerificationCode.objects.filter(email=email).update(
                created_at=timezone.now() - timedelta(hours=2)
            )

        assert is_throttled(email) is True

    def test_throttling_does_not_consume_an_outstanding_code(self):
        code = issue_code("someone@example.com")
        for _ in range(5):
            issue_code("someone@example.com")

        # The first code was superseded by the second issue, not by the
        # throttled ones — those must not have touched anything.
        assert verify_code("someone@example.com", code) is False
        assert RequesterVerificationCode.objects.count() == (
            RequesterVerificationCode.THROTTLE_PER_HOUR
        )


class TestPruning:
    def test_prunes_only_rows_past_retention(self):
        email = "someone@example.com"
        issue_code(email)
        RequesterVerificationCode.objects.filter(email=email).update(
            created_at=timezone.now()
            - timedelta(hours=RequesterVerificationCode.RETENTION_HOURS + 1)
        )
        issue_code(email)

        assert RequesterVerificationCode.objects.count() == 1

    def test_retention_covers_the_longest_throttle_window(self):
        """If rows are pruned sooner than the daily window is measured over, the
        daily limit silently stops being enforceable."""
        assert RequesterVerificationCode.RETENTION_HOURS >= 24


class TestVerificationAudit:
    def test_records_successful_verification(self):
        code = issue_code("someone@example.com")
        verify_code("someone@example.com", code)

        assert RequesterVerification.objects.filter(
            email="someone@example.com"
        ).exists()

    def test_does_not_record_failed_verification(self):
        issue_code("someone@example.com")
        verify_code("someone@example.com", "000000")

        assert RequesterVerification.objects.count() == 0

    def test_drops_records_past_retention(self):
        RequesterVerification.objects.create(email="old@example.com")
        RequesterVerification.objects.update(
            verified_at=timezone.now()
            - timedelta(days=RequesterVerification.RETENTION_DAYS + 1)
        )

        code = issue_code("someone@example.com")
        verify_code("someone@example.com", code)

        assert not RequesterVerification.objects.filter(
            email="old@example.com"
        ).exists()


class TestSessionToken:
    def test_round_trips_the_email(self):
        token = make_session_token("Someone@Example.com")
        assert read_session_token(token) == "someone@example.com"

    def test_rejects_a_tampered_token(self):
        token = make_session_token("someone@example.com")
        assert read_session_token(token[:-2] + "xy") is None

    def test_rejects_an_unsigned_payload(self):
        assert read_session_token("someone@example.com") is None


class TestCaseLookup:
    def test_matches_regardless_of_stored_capitalisation(self, case):
        # The fixture's address is stored as "Jane.Smith@Example.com".
        assert cases_for_email("jane.smith@example.com").count() == 1

    def test_does_not_match_a_different_address(self, case):
        assert cases_for_email("someone.else@example.com").count() == 0


def test_normalise_email_handles_whitespace_and_none():
    assert normalise_email("  Someone@Example.com  ") == "someone@example.com"
    assert normalise_email("") == ""
    assert normalise_email(None) == ""
