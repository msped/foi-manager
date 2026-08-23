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
        foi_team_user.set_password("testpass123")
        foi_team_user.save()
        url = reverse("users:rest_login")
        resp = api_client.post(
            url, {"email": foi_team_user.email, "password": "testpass123"}
        )
        assert resp.status_code == 200
        assert "access" in resp.data
        assert "refresh" in resp.data

    def test_obtain_token_with_wrong_password(self, api_client, foi_team_user):
        """400, not 401.

        dj-rest-auth rejects bad credentials in LoginSerializer.validate, and a
        serializer failure is a 400. The frontend does not depend on the
        difference — `callDjango` in lib/auth.ts treats any non-ok response the
        same and reports "Invalid email or password" either way.
        """
        url = reverse("users:rest_login")
        resp = api_client.post(
            url, {"email": foi_team_user.email, "password": "wrongpass"}
        )
        assert resp.status_code == 400
        assert "access" not in resp.data

    def test_refresh_token(self, api_client, foi_team_user):
        foi_team_user.set_password("testpass123")
        foi_team_user.save()
        obtain_url = reverse("users:rest_login")
        tokens = api_client.post(
            obtain_url, {"email": foi_team_user.email, "password": "testpass123"}
        ).data
        refresh_url = reverse("users:token_refresh")
        resp = api_client.post(refresh_url, {"refresh": tokens["refresh"]})
        assert resp.status_code == 200
        assert "access" in resp.data


class TestCurrentUser:
    def test_me_returns_current_user(self, auth_client, foi_team_user):
        url = reverse("users:rest_user_details")
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data["email"] == foi_team_user.email
        assert resp.data["role"] == foi_team_user.role

    def test_me_unauthenticated(self, api_client):
        url = reverse("users:rest_user_details")
        resp = api_client.get(url)
        assert resp.status_code == 401


class TestUserList:
    def test_foi_team_can_list_users(self, auth_client, foi_team_user, assignee_user):
        """This endpoint is the FOI team picker, so it is filtered to that role
        and unpaginated — hence a bare list rather than a results envelope.

        The assertion that an assignee appears here was wrong in both
        directions: they are excluded on purpose, and including them would put
        every consulted colleague in a dropdown meant for case ownership.
        Assignees are found through users/search/ instead.
        """
        url = reverse("users:user-list")
        resp = auth_client.get(url)
        assert resp.status_code == 200
        emails = [u["email"] for u in resp.data]
        assert foi_team_user.email in emails
        assert assignee_user.email not in emails

    def test_assignee_cannot_list_users(self, db, assignee_user):
        client = APIClient()
        client.force_authenticate(user=assignee_user)
        url = reverse("users:user-list")
        resp = client.get(url)
        assert resp.status_code == 403

    def test_unauthenticated_cannot_list(self, api_client):
        url = reverse("users:user-list")
        resp = api_client.get(url)
        assert resp.status_code == 401
