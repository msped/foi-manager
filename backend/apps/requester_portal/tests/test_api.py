"""Endpoint tests, focused on what the portal must never reveal.

The tracking endpoints have two jobs of equal weight: show a requester their own
requests, and tell everyone else nothing at all — including whether a given
address has ever made a request. The second job is the one that fails quietly,
so most of what follows tests for absence.
"""

import pytest
from django.core import mail
from django.urls import reverse

from apps.cases.models import Case, EmailTemplate
from apps.publications.models import DisclosureLogEntry
from apps.requester_portal.models import RequesterVerificationCode
from apps.requester_portal.verification import issue_code, make_session_token

pytestmark = pytest.mark.django_db


def code_for(email):
    """The code most recently issued to an address."""
    return (
        RequesterVerificationCode.objects.filter(email=email.lower())
        .order_by("-created_at")
        .first()
        .code
    )


class TestRequestCode:
    def test_sends_a_code_to_a_known_requester(self, api_client, case):
        resp = api_client.post(
            reverse("requester_portal:request-code"),
            {"email": "jane.smith@example.com"},
        )

        assert resp.status_code == 200
        assert len(mail.outbox) == 1
        assert code_for("jane.smith@example.com") in mail.outbox[0].body

    def test_unknown_address_gets_the_same_answer_and_no_email(self, api_client, case):
        known = api_client.post(
            reverse("requester_portal:request-code"),
            {"email": "jane.smith@example.com"},
        )
        mail.outbox.clear()

        unknown = api_client.post(
            reverse("requester_portal:request-code"),
            {"email": "nobody@example.com"},
        )

        # Identical status and body. Any difference here is an oracle for
        # "has this person made an FOI request to you?".
        assert unknown.status_code == known.status_code
        assert unknown.data == known.data
        assert mail.outbox == []

    def test_throttled_address_gets_the_same_answer(self, api_client, case):
        url = reverse("requester_portal:request-code")
        payload = {"email": "jane.smith@example.com"}

        first = api_client.post(url, payload)
        for _ in range(RequesterVerificationCode.THROTTLE_PER_HOUR):
            api_client.post(url, payload)
        mail.outbox.clear()

        throttled = api_client.post(url, payload)

        assert throttled.status_code == first.status_code
        assert throttled.data == first.data
        assert mail.outbox == []

    def test_rejects_a_malformed_address(self, api_client):
        resp = api_client.post(
            reverse("requester_portal:request-code"), {"email": "not-an-address"}
        )
        assert resp.status_code == 400

    def test_matches_the_requester_regardless_of_capitalisation(self, api_client, case):
        # The case fixture stores "Jane.Smith@Example.com".
        resp = api_client.post(
            reverse("requester_portal:request-code"),
            {"email": "JANE.SMITH@EXAMPLE.COM"},
        )

        assert resp.status_code == 200
        assert len(mail.outbox) == 1


class TestVerificationEmail:
    def test_carries_no_case_detail(self, api_client, case):
        api_client.post(
            reverse("requester_portal:request-code"),
            {"email": "jane.smith@example.com"},
        )
        body = mail.outbox[0].body

        # Anyone can trigger this email by typing an address, so it must be safe
        # to deliver to a stranger who mistyped their own.
        assert case.ref not in body
        assert case.request_text not in body
        assert case.requester_name not in body

    def test_falls_back_when_no_template_is_configured(self, api_client, case):
        assert not EmailTemplate.objects.filter(
            purpose=EmailTemplate.Purpose.VERIFICATION_CODE
        ).exists()

        api_client.post(
            reverse("requester_portal:request-code"),
            {"email": "jane.smith@example.com"},
        )

        # A missing template hard-fails every other email in the system. Here it
        # must not: the person waiting has no way to report a code that never
        # arrives.
        assert len(mail.outbox) == 1
        assert code_for("jane.smith@example.com") in mail.outbox[0].body

    def test_uses_the_template_when_one_exists(self, api_client, case):
        EmailTemplate.objects.create(
            purpose=EmailTemplate.Purpose.VERIFICATION_CODE,
            name="Verification code",
            subject="Your code",
            body="<p>Code: {{code}}</p>",
        )

        api_client.post(
            reverse("requester_portal:request-code"),
            {"email": "jane.smith@example.com"},
        )

        assert mail.outbox[0].subject == "Your code"
        assert "Code: " in mail.outbox[0].body


class TestTemplateGuard:
    """`EmailTemplate.render()` is a plain string replace, so a template that
    drops {{code}} sends a perfectly deliverable email containing no code and
    raises nothing. Caught at save time instead."""

    def test_rejects_a_template_with_no_code_placeholder(self):
        from django.core.exceptions import ValidationError

        with pytest.raises(ValidationError):
            EmailTemplate.objects.create(
                purpose=EmailTemplate.Purpose.VERIFICATION_CODE,
                name="Broken",
                body="<p>Here is your code.</p>",
            )

    def test_accepts_a_template_containing_the_placeholder(self):
        template = EmailTemplate.objects.create(
            purpose=EmailTemplate.Purpose.VERIFICATION_CODE,
            name="Fine",
            body="<p>{{code}}</p>",
        )
        # PURPOSE_TYPE_MAP must know this purpose or save() raises KeyError.
        assert template.type == EmailTemplate.Type.REQUESTER


class TestVerify:
    def test_correct_code_returns_a_token(self, api_client, case):
        code = issue_code("jane.smith@example.com")

        resp = api_client.post(
            reverse("requester_portal:verify"),
            {"email": "jane.smith@example.com", "code": code},
        )

        assert resp.status_code == 200
        assert resp.data["token"]

    def test_wrong_code_is_rejected(self, api_client, case):
        issue_code("jane.smith@example.com")

        resp = api_client.post(
            reverse("requester_portal:verify"),
            {"email": "jane.smith@example.com", "code": "000000"},
        )

        assert resp.status_code == 400

    def test_failures_are_indistinguishable(self, api_client, case):
        """Wrong code, expired code and no code at all must read identically —
        otherwise the error message says which addresses are worth pursuing."""
        issue_code("jane.smith@example.com")
        wrong = api_client.post(
            reverse("requester_portal:verify"),
            {"email": "jane.smith@example.com", "code": "000000"},
        )
        never_issued = api_client.post(
            reverse("requester_portal:verify"),
            {"email": "nobody@example.com", "code": "000000"},
        )

        assert wrong.status_code == never_issued.status_code
        assert wrong.data == never_issued.data


class TestTrackedCases:
    def _token_for(self, email):
        return make_session_token(email)

    def test_lists_the_requesters_own_cases(self, api_client, case):
        resp = api_client.get(
            reverse("requester_portal:requests"),
            HTTP_X_FOI_TRACK_TOKEN=self._token_for("jane.smith@example.com"),
        )

        assert resp.status_code == 200
        assert [c["ref"] for c in resp.data["results"]] == [case.ref]

    def test_does_not_list_other_peoples_cases(self, api_client, case):
        Case.objects.create(
            requester_name="Someone Else",
            requester_email="other@example.com",
            request_text="Unrelated request.",
        )

        resp = api_client.get(
            reverse("requester_portal:requests"),
            HTTP_X_FOI_TRACK_TOKEN=self._token_for("jane.smith@example.com"),
        )

        assert [c["ref"] for c in resp.data["results"]] == [case.ref]

    def test_requires_a_token(self, api_client, case):
        resp = api_client.get(reverse("requester_portal:requests"))
        assert resp.status_code == 401

    def test_rejects_a_forged_token(self, api_client, case):
        resp = api_client.get(
            reverse("requester_portal:requests"),
            HTTP_X_FOI_TRACK_TOKEN="jane.smith@example.com",
        )
        assert resp.status_code == 401


class TestWhatTheCasePayloadExposes:
    def _fetch(self, api_client, email="jane.smith@example.com"):
        resp = api_client.get(
            reverse("requester_portal:requests"),
            HTTP_X_FOI_TRACK_TOKEN=make_session_token(email),
        )
        return resp.data["results"][0]

    def test_never_includes_the_response_body(self, api_client, case):
        case.responses.create(body="Sensitive third-party detail.")

        payload = self._fetch(api_client)

        # Deliberate: responses carry third-party data cleared for one named
        # recipient, and a shared mailbox verifies once for everyone using it.
        assert "response" not in payload
        assert "Sensitive third-party detail." not in str(payload)

    def test_never_includes_casework_fields(self, api_client, case):
        payload = self._fetch(api_client)

        for field in ("assignee", "created_by", "summary", "notes", "exemptions"):
            assert field not in payload

    def test_translates_internal_status_vocabulary(self, api_client, case):
        case.status = Case.Status.DRAFTING
        case.save()

        payload = self._fetch(api_client)

        assert payload["status"] == "Being processed"
        assert payload["status"] != case.get_status_display()

    def test_tells_the_requester_when_we_are_waiting_on_them(self, api_client, case):
        case.status = Case.Status.WITH_APPLICANT
        case.save()

        assert self._fetch(api_client)["status"] == "Awaiting your response"

    def test_names_the_ico_rather_than_saying_referred(self, api_client, case):
        case.status = Case.Status.REFERRED
        case.save()

        assert self._fetch(api_client)["status"] == "With the Information Commissioner"

    def test_suppresses_the_deadline_while_the_clock_is_paused(self, api_client, case):
        case.pause_clock(reason="clarification_requested")

        payload = self._fetch(api_client)

        # The stored deadline is stale by definition mid-pause: it is only
        # brought up to date by resume_clock().
        assert payload["statutory_deadline"] is None
        assert payload["is_overdue"] is False

    def test_reports_the_outcome_in_plain_words(self, api_client, case):
        case.outcome = Case.Outcome.NOT_HELD
        case.save()

        assert self._fetch(api_client)["outcome"] == "Information not held"

    def test_links_to_the_disclosure_log_only_once_published(self, api_client, case):
        entry = DisclosureLogEntry.objects.create(
            case=case, title="IT contracts", status=DisclosureLogEntry.Status.DRAFT
        )

        assert self._fetch(api_client)["disclosure_log_id"] is None

        entry.status = DisclosureLogEntry.Status.PUBLISHED
        entry.save()

        assert self._fetch(api_client)["disclosure_log_id"] == entry.pk
