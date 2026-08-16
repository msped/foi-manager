import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.cases.models import Case, CaseAuditEvent, CaseCRUAdvice


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(foi_team_user):
    client = APIClient()
    client.force_authenticate(user=foi_team_user)
    return client


@pytest.fixture
def assignee_client(assignee_user):
    client = APIClient()
    client.force_authenticate(user=assignee_user)
    return client


@pytest.fixture
def case(db, foi_team_user):
    return Case.objects.create(
        requester_name="Jane Smith",
        requester_email="jane@example.com",
        request_text="All stop and search figures.",
        created_by=foi_team_user,
    )


@pytest.fixture
def url(case):
    return reverse("cases:case-cru-advice", kwargs={"case_pk": case.pk})


class TestCRUAdviceRead:
    def test_get_returns_empty_shape_when_never_referred(self, auth_client, case, url):
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data["request_sent_at"] is None
        assert resp.data["advice"] == ""

    def test_get_does_not_create_a_record(self, auth_client, case, url):
        auth_client.get(url)
        assert not CaseCRUAdvice.objects.filter(case=case).exists()

    def test_anonymous_cannot_read(self, api_client, url):
        assert api_client.get(url).status_code == 401


class TestCRUAdviceWrite:
    def test_recording_request_sent_creates_record(self, auth_client, case, url):
        resp = auth_client.put(url, {"request_sent_at": "2026-08-10"}, format="json")
        assert resp.status_code == 200
        advice = CaseCRUAdvice.objects.get(case=case)
        assert advice.request_sent_at.isoformat() == "2026-08-10"

    def test_second_put_updates_the_same_record(self, auth_client, case, url):
        auth_client.put(url, {"request_sent_at": "2026-08-10"}, format="json")
        auth_client.put(
            url,
            {"received_at": "2026-08-14", "advice": "Apply s.31."},
            format="json",
        )
        assert CaseCRUAdvice.objects.filter(case=case).count() == 1
        advice = CaseCRUAdvice.objects.get(case=case)
        assert advice.request_sent_at.isoformat() == "2026-08-10"
        assert advice.advice == "Apply s.31."

    def test_received_without_request_sent_rejected(self, auth_client, url):
        resp = auth_client.put(url, {"received_at": "2026-08-14"}, format="json")
        assert resp.status_code == 400
        assert "request_sent_at" in resp.data

    def test_received_before_sent_rejected(self, auth_client, url):
        resp = auth_client.put(
            url,
            {"request_sent_at": "2026-08-14", "received_at": "2026-08-10"},
            format="json",
        )
        assert resp.status_code == 400
        assert "received_at" in resp.data

    def test_assignee_cannot_write(self, assignee_client, url):
        resp = assignee_client.put(url, {"request_sent_at": "2026-08-10"}, format="json")
        assert resp.status_code == 403

    def test_anonymous_cannot_write(self, api_client, url):
        resp = api_client.put(url, {"request_sent_at": "2026-08-10"}, format="json")
        assert resp.status_code == 401

    def test_delete_clears_the_record(self, auth_client, case, url):
        auth_client.put(url, {"request_sent_at": "2026-08-10"}, format="json")
        assert auth_client.delete(url).status_code == 204
        assert not CaseCRUAdvice.objects.filter(case=case).exists()


class TestCRUAdviceAudit:
    def test_request_sent_logged_once(self, auth_client, case, url):
        auth_client.put(url, {"request_sent_at": "2026-08-10"}, format="json")
        auth_client.put(url, {"advice": "Still waiting."}, format="json")
        events = CaseAuditEvent.objects.filter(case=case, action="cru_request_sent")
        assert events.count() == 1
        assert events.first().detail["request_sent_at"] == "2026-08-10"

    def test_advice_received_logged(self, auth_client, case, foi_team_user, url):
        auth_client.put(
            url,
            {"request_sent_at": "2026-08-10", "received_at": "2026-08-14"},
            format="json",
        )
        event = CaseAuditEvent.objects.get(case=case, action="cru_advice_received")
        assert event.actor == foi_team_user
        assert event.detail["received_at"] == "2026-08-14"

    def test_no_audit_event_for_advice_text_alone(self, auth_client, case, url):
        auth_client.put(url, {"advice": "Verbal steer only."}, format="json")
        assert not CaseAuditEvent.objects.filter(
            case=case, action__startswith="cru_"
        ).exists()
