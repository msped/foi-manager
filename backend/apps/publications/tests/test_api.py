import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.publications.models import PublicationSchemeEntry


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(foi_team_user):
    client = APIClient()
    client.force_authenticate(user=foi_team_user)
    return client


@pytest.fixture
def entry(db, foi_team_user):
    return PublicationSchemeEntry.objects.create(
        title="Organisational structure",
        category=PublicationSchemeEntry.Category.WHO_WE_ARE,
        description="Our org chart and senior staff.",
        url="https://example.gov.uk/about",
        created_by=foi_team_user,
    )


class TestPublicPublicationList:
    def test_anonymous_can_list(self, api_client, entry):
        url = reverse("publications:scheme-list")
        resp = api_client.get(url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_filter_by_category(self, api_client, db, foi_team_user, entry):
        PublicationSchemeEntry.objects.create(
            title="Budget 2025",
            category=PublicationSchemeEntry.Category.FINANCES,
            created_by=foi_team_user,
        )
        url = reverse("publications:scheme-list")
        resp = api_client.get(url, {"category": "who_we_are"})
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["title"] == "Organisational structure"

    def test_anonymous_can_retrieve(self, api_client, entry):
        url = reverse("publications:scheme-detail", kwargs={"pk": entry.pk})
        resp = api_client.get(url)
        assert resp.status_code == 200
        assert resp.data["title"] == "Organisational structure"


class TestStaffPublicationWrite:
    def test_foi_team_can_create(self, auth_client, db):
        url = reverse("publications:scheme-list")
        resp = auth_client.post(
            url,
            {
                "title": "Pay policy",
                "category": "policies",
                "description": "Our pay policy statement.",
                "url": "https://example.gov.uk/pay",
            },
        )
        assert resp.status_code == 201
        assert PublicationSchemeEntry.objects.filter(title="Pay policy").exists()

    def test_foi_team_can_update(self, auth_client, entry):
        url = reverse("publications:scheme-detail", kwargs={"pk": entry.pk})
        resp = auth_client.patch(url, {"title": "Updated title"})
        assert resp.status_code == 200
        entry.refresh_from_db()
        assert entry.title == "Updated title"

    def test_foi_team_can_delete(self, auth_client, entry):
        url = reverse("publications:scheme-detail", kwargs={"pk": entry.pk})
        resp = auth_client.delete(url)
        assert resp.status_code == 204
        assert not PublicationSchemeEntry.objects.filter(pk=entry.pk).exists()

    def test_anonymous_cannot_create(self, api_client, db):
        url = reverse("publications:scheme-list")
        resp = api_client.post(
            url,
            {
                "title": "Sneaky entry",
                "category": "policies",
            },
        )
        assert resp.status_code == 401

    def test_assignee_cannot_create(self, db, assignee_user):
        client = APIClient()
        client.force_authenticate(user=assignee_user)
        url = reverse("publications:scheme-list")
        resp = client.post(url, {"title": "Sneaky entry", "category": "policies"})
        assert resp.status_code == 403
