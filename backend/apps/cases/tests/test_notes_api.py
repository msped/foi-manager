import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.cases.models import Case, CaseNote, Department


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
    return Department.objects.create(name='IT')


@pytest.fixture
def case(db, foi_team_user, department):
    return Case.objects.create(
        requester_name='Jane Smith',
        requester_email='jane@example.com',
        request_text='All IT contracts.',
        department=department,
        created_by=foi_team_user,
    )


@pytest.fixture
def assigned_case(db, foi_team_user, assignee_user, department):
    return Case.objects.create(
        requester_name='Bob',
        requester_email='bob@example.com',
        request_text='Assigned request.',
        department=department,
        created_by=foi_team_user,
        assignee=assignee_user,
    )


class TestCaseNoteCreate:
    def test_foi_team_can_add_note(self, auth_client, case, foi_team_user):
        url = reverse('cases:case-notes-list', kwargs={'case_pk': case.pk})
        resp = auth_client.post(url, {'body': 'Chased IT department.'})
        assert resp.status_code == 201
        assert CaseNote.objects.filter(case=case).count() == 1

    def test_note_author_set_to_request_user(self, auth_client, case, foi_team_user):
        url = reverse('cases:case-notes-list', kwargs={'case_pk': case.pk})
        auth_client.post(url, {'body': 'Chased IT department.'})
        note = CaseNote.objects.get(case=case)
        assert note.author == foi_team_user

    def test_assignee_can_add_note_to_assigned_case(self, assignee_client, assigned_case):
        url = reverse('cases:case-notes-list', kwargs={'case_pk': assigned_case.pk})
        resp = assignee_client.post(url, {'body': 'Here is the info you need.'})
        assert resp.status_code == 201

    def test_assignee_cannot_add_note_to_unassigned_case(self, assignee_client, case):
        url = reverse('cases:case-notes-list', kwargs={'case_pk': case.pk})
        resp = assignee_client.post(url, {'body': 'Sneaky note.'})
        assert resp.status_code == 404

    def test_anonymous_cannot_add_note(self, api_client, case):
        url = reverse('cases:case-notes-list', kwargs={'case_pk': case.pk})
        resp = api_client.post(url, {'body': 'Anonymous note.'})
        assert resp.status_code == 401

    def test_empty_body_rejected(self, auth_client, case):
        url = reverse('cases:case-notes-list', kwargs={'case_pk': case.pk})
        resp = auth_client.post(url, {'body': ''})
        assert resp.status_code == 400


class TestCaseNoteList:
    def test_foi_team_can_list_notes(self, auth_client, case, foi_team_user):
        CaseNote.objects.create(case=case, author=foi_team_user, body='Note one.')
        CaseNote.objects.create(case=case, author=foi_team_user, body='Note two.')
        url = reverse('cases:case-notes-list', kwargs={'case_pk': case.pk})
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data['count'] == 2

    def test_notes_returned_in_chronological_order(self, auth_client, case, foi_team_user):
        CaseNote.objects.create(case=case, author=foi_team_user, body='First.')
        CaseNote.objects.create(case=case, author=foi_team_user, body='Second.')
        url = reverse('cases:case-notes-list', kwargs={'case_pk': case.pk})
        resp = auth_client.get(url)
        assert resp.data['results'][0]['body'] == 'First.'
        assert resp.data['results'][1]['body'] == 'Second.'
