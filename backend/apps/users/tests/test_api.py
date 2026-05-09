import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(foi_team_user):
    client = APIClient()
    client.force_authenticate(user=foi_team_user)
    return client


class TestAuthToken:
    def test_obtain_token_with_valid_credentials(self, api_client, foi_team_user):
        foi_team_user.set_password('testpass123')
        foi_team_user.save()
        url = reverse('users:token-obtain')
        resp = api_client.post(url, {'email': foi_team_user.email, 'password': 'testpass123'})
        assert resp.status_code == 200
        assert 'access' in resp.data
        assert 'refresh' in resp.data

    def test_obtain_token_with_wrong_password(self, api_client, foi_team_user):
        url = reverse('users:token-obtain')
        resp = api_client.post(url, {'email': foi_team_user.email, 'password': 'wrongpass'})
        assert resp.status_code == 401

    def test_refresh_token(self, api_client, foi_team_user):
        foi_team_user.set_password('testpass123')
        foi_team_user.save()
        obtain_url = reverse('users:token-obtain')
        tokens = api_client.post(obtain_url, {'email': foi_team_user.email, 'password': 'testpass123'}).data
        refresh_url = reverse('users:token-refresh')
        resp = api_client.post(refresh_url, {'refresh': tokens['refresh']})
        assert resp.status_code == 200
        assert 'access' in resp.data


class TestCurrentUser:
    def test_me_returns_current_user(self, auth_client, foi_team_user):
        url = reverse('users:me')
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data['email'] == foi_team_user.email
        assert resp.data['role'] == foi_team_user.role

    def test_me_unauthenticated(self, api_client):
        url = reverse('users:me')
        resp = api_client.get(url)
        assert resp.status_code == 401


class TestUserList:
    def test_foi_team_can_list_users(self, auth_client, foi_team_user, assignee_user):
        url = reverse('users:user-list')
        resp = auth_client.get(url)
        assert resp.status_code == 200
        emails = [u['email'] for u in resp.data['results']]
        assert foi_team_user.email in emails
        assert assignee_user.email in emails

    def test_assignee_cannot_list_users(self, db, assignee_user):
        client = APIClient()
        client.force_authenticate(user=assignee_user)
        url = reverse('users:user-list')
        resp = client.get(url)
        assert resp.status_code == 403

    def test_unauthenticated_cannot_list(self, api_client):
        url = reverse('users:user-list')
        resp = api_client.get(url)
        assert resp.status_code == 401
