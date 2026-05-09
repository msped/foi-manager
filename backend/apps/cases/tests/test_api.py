import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.cases.models import Case, Department


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
def department(db):
    return Department.objects.create(name='IT', internal_deadline_days=10)


@pytest.fixture
def case(db, foi_team_user, department):
    return Case.objects.create(
        requester_name='Jane Smith',
        requester_email='jane@example.com',
        request_text='All IT contracts over £10k.',
        department=department,
        created_by=foi_team_user,
    )


# ── Public submission ────────────────────────────────────────────────────────

class TestPublicCaseSubmit:
    def test_anonymous_can_submit(self, api_client, db):
        url = reverse('cases:public-submit')
        resp = api_client.post(url, {
            'requester_name': 'John Public',
            'requester_email': 'john@example.com',
            'request_text': 'Please provide all parking enforcement data.',
        })
        assert resp.status_code == 201
        assert 'ref' in resp.data
        assert resp.data['ref'].startswith('FOI-')

    def test_submit_requires_name(self, api_client, db):
        url = reverse('cases:public-submit')
        resp = api_client.post(url, {
            'requester_email': 'john@example.com',
            'request_text': 'Parking data.',
        })
        assert resp.status_code == 400

    def test_submit_requires_email(self, api_client, db):
        url = reverse('cases:public-submit')
        resp = api_client.post(url, {
            'requester_name': 'John Public',
            'request_text': 'Parking data.',
        })
        assert resp.status_code == 400

    def test_submit_requires_request_text(self, api_client, db):
        url = reverse('cases:public-submit')
        resp = api_client.post(url, {
            'requester_name': 'John Public',
            'requester_email': 'john@example.com',
        })
        assert resp.status_code == 400


# ── Public status tracking ───────────────────────────────────────────────────

class TestPublicCaseTrack:
    def test_can_track_by_ref_and_email(self, api_client, case):
        url = reverse('cases:public-track')
        resp = api_client.get(url, {'ref': case.ref, 'email': case.requester_email})
        assert resp.status_code == 200
        assert resp.data['ref'] == case.ref
        assert resp.data['status'] == case.status

    def test_wrong_email_returns_404(self, api_client, case):
        url = reverse('cases:public-track')
        resp = api_client.get(url, {'ref': case.ref, 'email': 'wrong@example.com'})
        assert resp.status_code == 404

    def test_does_not_expose_internal_fields(self, api_client, case):
        url = reverse('cases:public-track')
        resp = api_client.get(url, {'ref': case.ref, 'email': case.requester_email})
        assert 'assignee' not in resp.data
        assert 'created_by' not in resp.data


# ── Staff case list ──────────────────────────────────────────────────────────

class TestStaffCaseList:
    def test_foi_team_sees_all_cases(self, auth_client, case):
        url = reverse('cases:case-list')
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data['count'] == 1

    def test_unauthenticated_denied(self, api_client, case):
        url = reverse('cases:case-list')
        resp = api_client.get(url)
        assert resp.status_code == 401

    def test_assignee_sees_only_assigned(self, assignee_client, assignee_user, case, db, foi_team_user, department):
        assigned_case = Case.objects.create(
            requester_name='Alice',
            requester_email='alice@example.com',
            request_text='Another request.',
            department=department,
            assignee=assignee_user,
            created_by=foi_team_user,
        )
        url = reverse('cases:case-list')
        resp = assignee_client.get(url)
        assert resp.status_code == 200
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['ref'] == assigned_case.ref

    def test_filter_by_status(self, auth_client, case, foi_team_user, department):
        Case.objects.create(
            requester_name='Bob',
            requester_email='bob@example.com',
            request_text='Another.',
            department=department,
            created_by=foi_team_user,
            status=Case.Status.ACKNOWLEDGED,
        )
        url = reverse('cases:case-list')
        resp = auth_client.get(url, {'status': 'new'})
        assert resp.data['count'] == 1
        assert resp.data['results'][0]['status'] == 'new'


# ── Staff case detail ────────────────────────────────────────────────────────

class TestStaffCaseDetail:
    def test_foi_team_can_retrieve(self, auth_client, case):
        url = reverse('cases:case-detail', kwargs={'pk': case.pk})
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data['ref'] == case.ref

    def test_assignee_cannot_retrieve_unassigned(self, assignee_client, case):
        url = reverse('cases:case-detail', kwargs={'pk': case.pk})
        resp = assignee_client.get(url)
        assert resp.status_code == 404


# ── Case actions ─────────────────────────────────────────────────────────────

class TestCaseAcknowledge:
    def test_acknowledge_action(self, auth_client, case):
        url = reverse('cases:case-acknowledge', kwargs={'pk': case.pk})
        resp = auth_client.post(url)
        assert resp.status_code == 200
        case.refresh_from_db()
        assert case.status == Case.Status.ACKNOWLEDGED
        assert case.statutory_deadline is not None

    def test_assignee_cannot_acknowledge(self, assignee_client, case):
        url = reverse('cases:case-acknowledge', kwargs={'pk': case.pk})
        resp = assignee_client.post(url)
        assert resp.status_code in (403, 404)


class TestCaseTransition:
    def test_transition_to_with_department(self, auth_client, case):
        url = reverse('cases:case-transition', kwargs={'pk': case.pk})
        resp = auth_client.post(url, {'status': 'with_department'})
        assert resp.status_code == 200
        case.refresh_from_db()
        assert case.status == Case.Status.WITH_DEPARTMENT

    def test_invalid_status_rejected(self, auth_client, case):
        url = reverse('cases:case-transition', kwargs={'pk': case.pk})
        resp = auth_client.post(url, {'status': 'not_a_real_status'})
        assert resp.status_code == 400
