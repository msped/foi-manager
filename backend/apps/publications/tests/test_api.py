import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.publications.models import PublicationSchemeEntry, PublicationSchemeItem


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
    """A draft entry with one link on it, so it is publishable."""
    entry = PublicationSchemeEntry.objects.create(
        title="Organisational structure",
        category=PublicationSchemeEntry.Category.WHO_WE_ARE,
        description="Our org chart and senior staff.",
        created_by=foi_team_user,
    )
    PublicationSchemeItem.objects.create(
        entry=entry,
        kind=PublicationSchemeItem.Kind.LINK,
        label="Structure chart",
        url="https://example.gov.uk/about",
    )
    return entry


@pytest.fixture
def published_entry(entry, foi_team_user):
    entry.status = PublicationSchemeEntry.Status.PUBLISHED
    entry.published_by = foi_team_user
    entry.save()
    return entry


class TestPublicScheme:
    def test_anonymous_sees_published_entries(self, api_client, published_entry):
        url = reverse("publications:public-scheme-list")
        resp = api_client.get(url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_anonymous_never_sees_drafts(self, api_client, entry):
        """The load-bearing assertion of the whole draft feature."""
        url = reverse("publications:public-scheme-list")
        resp = api_client.get(url)
        assert resp.status_code == 200
        assert resp.data["count"] == 0

    def test_draft_detail_is_404_not_403(self, api_client, entry):
        url = reverse("publications:public-scheme-detail", kwargs={"pk": entry.pk})
        assert api_client.get(url).status_code == 404

    def test_public_payload_omits_internal_fields(self, api_client, published_entry):
        """Absent from the serializer rather than hidden by the frontend, so no
        later change to the public page can start rendering them."""
        url = reverse("publications:public-scheme-list")
        result = api_client.get(url).data["results"][0]
        assert "status" not in result
        assert "published_by" not in result
        assert "created_by" not in result

    def test_public_payload_carries_items(self, api_client, published_entry):
        url = reverse("publications:public-scheme-list")
        result = api_client.get(url).data["results"][0]
        assert [i["label"] for i in result["items"]] == ["Structure chart"]

    def test_filter_by_category(self, api_client, published_entry, foi_team_user):
        PublicationSchemeEntry.objects.create(
            title="Budget 2025",
            category=PublicationSchemeEntry.Category.FINANCES,
            status=PublicationSchemeEntry.Status.PUBLISHED,
            created_by=foi_team_user,
        )
        url = reverse("publications:public-scheme-list")
        resp = api_client.get(url, {"category": "who_we_are"})
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["title"] == "Organisational structure"


class TestStaffSchemeAccess:
    def test_staff_see_drafts(self, auth_client, entry):
        url = reverse("publications:scheme-list")
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_anonymous_cannot_read_staff_route(self, api_client, entry):
        """This route used to be AllowAny on reads. It must not be any more —
        it is now the only route that returns drafts."""
        url = reverse("publications:scheme-list")
        assert api_client.get(url).status_code == 401

    def test_assignee_cannot_read_staff_route(self, db, assignee_user, entry):
        client = APIClient()
        client.force_authenticate(user=assignee_user)
        url = reverse("publications:scheme-list")
        assert client.get(url).status_code == 403


class TestStaffSchemeWrite:
    def test_foi_team_can_create(self, auth_client, db):
        url = reverse("publications:scheme-list")
        resp = auth_client.post(
            url,
            {
                "title": "Pay policy",
                "category": "policies",
                "description": "<p>Our pay policy statement.</p>",
            },
        )
        assert resp.status_code == 201
        assert PublicationSchemeEntry.objects.filter(title="Pay policy").exists()

    def test_created_entries_are_drafts(self, auth_client, db):
        url = reverse("publications:scheme-list")
        resp = auth_client.post(url, {"title": "New", "category": "policies"})
        assert resp.data["status"] == "draft"

    def test_status_cannot_be_set_by_patch(self, auth_client, entry):
        """Publication goes through the publish action, which is where the
        "does this point anywhere" check lives. A writable status field would
        be a way straight past it."""
        url = reverse("publications:scheme-detail", kwargs={"pk": entry.pk})
        resp = auth_client.patch(url, {"status": "published"})
        assert resp.status_code == 200
        entry.refresh_from_db()
        assert entry.status == PublicationSchemeEntry.Status.DRAFT

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
        resp = api_client.post(url, {"title": "Sneaky entry", "category": "policies"})
        assert resp.status_code == 401

    def test_assignee_cannot_create(self, db, assignee_user):
        client = APIClient()
        client.force_authenticate(user=assignee_user)
        url = reverse("publications:scheme-list")
        resp = client.post(url, {"title": "Sneaky entry", "category": "policies"})
        assert resp.status_code == 403


class TestPublishActions:
    def test_publish_records_who_and_when(self, auth_client, entry, foi_team_user):
        url = reverse("publications:scheme-publish", kwargs={"pk": entry.pk})
        resp = auth_client.post(url)
        assert resp.status_code == 200
        entry.refresh_from_db()
        assert entry.status == PublicationSchemeEntry.Status.PUBLISHED
        assert entry.published_by == foi_team_user
        assert entry.published_at is not None

    def test_cannot_publish_an_entry_pointing_nowhere(self, auth_client, db):
        """A published entry with no links reads as information being withheld
        rather than as someone having forgotten the attachment."""
        empty = PublicationSchemeEntry.objects.create(
            title="Nothing attached",
            category=PublicationSchemeEntry.Category.POLICIES,
        )
        url = reverse("publications:scheme-publish", kwargs={"pk": empty.pk})
        resp = auth_client.post(url)
        assert resp.status_code == 400
        empty.refresh_from_db()
        assert empty.status == PublicationSchemeEntry.Status.DRAFT

    def test_cannot_publish_twice(self, auth_client, published_entry):
        url = reverse(
            "publications:scheme-publish", kwargs={"pk": published_entry.pk}
        )
        assert auth_client.post(url).status_code == 400

    def test_unpublish_clears_the_record(self, auth_client, published_entry):
        url = reverse(
            "publications:scheme-unpublish", kwargs={"pk": published_entry.pk}
        )
        resp = auth_client.post(url)
        assert resp.status_code == 200
        published_entry.refresh_from_db()
        assert published_entry.status == PublicationSchemeEntry.Status.DRAFT
        assert published_entry.published_by is None
        assert published_entry.published_at is None

    def test_cannot_unpublish_a_draft(self, auth_client, entry):
        url = reverse("publications:scheme-unpublish", kwargs={"pk": entry.pk})
        assert auth_client.post(url).status_code == 400

    def test_assignee_cannot_publish(self, db, assignee_user, entry):
        client = APIClient()
        client.force_authenticate(user=assignee_user)
        url = reverse("publications:scheme-publish", kwargs={"pk": entry.pk})
        assert client.post(url).status_code == 403


class TestSchemeItems:
    def test_create_link_item(self, auth_client, entry):
        url = reverse("publications:scheme-item-list")
        resp = auth_client.post(
            url,
            {
                "entry": entry.pk,
                "kind": "link",
                "label": "Annual report 2025",
                "url": "https://example.gov.uk/report",
            },
        )
        assert resp.status_code == 201
        assert entry.items.count() == 2

    def test_link_without_a_url_is_rejected(self, auth_client, entry):
        url = reverse("publications:scheme-item-list")
        resp = auth_client.post(url, {"entry": entry.pk, "kind": "link", "label": "X"})
        assert resp.status_code == 400
        assert "url" in resp.data

    def test_the_first_item_may_go_unlabelled(self, auth_client, db):
        """It is shown under the entry's own title, which reads correctly while
        it is the only one."""
        bare = PublicationSchemeEntry.objects.create(
            title="Pay policy", category=PublicationSchemeEntry.Category.POLICIES
        )
        url = reverse("publications:scheme-item-list")
        resp = auth_client.post(
            url,
            {"entry": bare.pk, "kind": "link", "url": "https://example.gov.uk/pay"},
        )
        assert resp.status_code == 201
        assert resp.data["display_label"] == "Pay policy"

    def test_a_second_item_must_be_labelled(self, auth_client, entry):
        """Two unlabelled items would give the entry two identical links."""
        url = reverse("publications:scheme-item-list")
        resp = auth_client.post(
            url,
            {"entry": entry.pk, "kind": "link", "url": "https://example.gov.uk/two"},
        )
        assert resp.status_code == 400
        assert "label" in resp.data

    def test_whitespace_does_not_count_as_a_label(self, auth_client, entry):
        url = reverse("publications:scheme-item-list")
        resp = auth_client.post(
            url,
            {
                "entry": entry.pk,
                "kind": "link",
                "label": "   ",
                "url": "https://example.gov.uk/two",
            },
        )
        assert resp.status_code == 400
        assert "label" in resp.data

    def test_a_lone_item_may_have_its_label_cleared(self, auth_client, db):
        """The rule is about collisions, so it must not fire on the one item
        that cannot collide with anything."""
        bare = PublicationSchemeEntry.objects.create(
            title="Pay policy", category=PublicationSchemeEntry.Category.POLICIES
        )
        item = PublicationSchemeItem.objects.create(
            entry=bare,
            kind=PublicationSchemeItem.Kind.LINK,
            label="Pay policy 2025",
            url="https://example.gov.uk/pay",
        )
        url = reverse("publications:scheme-item-detail", kwargs={"pk": item.pk})
        resp = auth_client.patch(url, {"label": ""})
        assert resp.status_code == 200
        assert resp.data["display_label"] == "Pay policy"

    def test_clearing_a_label_is_refused_when_siblings_exist(self, auth_client, entry):
        existing = entry.items.first()
        PublicationSchemeItem.objects.create(
            entry=entry,
            kind=PublicationSchemeItem.Kind.LINK,
            label="Second link",
            url="https://example.gov.uk/two",
        )
        url = reverse("publications:scheme-item-detail", kwargs={"pk": existing.pk})
        resp = auth_client.patch(url, {"label": ""})
        assert resp.status_code == 400
        assert "label" in resp.data

    def test_editing_a_labelled_item_does_not_trip_the_rule(self, auth_client, entry):
        """`self` must be excluded from the sibling check, or every item would
        count as its own collision."""
        existing = entry.items.first()
        url = reverse("publications:scheme-item-detail", kwargs={"pk": existing.pk})
        resp = auth_client.patch(url, {"label": "Renamed"})
        assert resp.status_code == 200

    def test_document_without_a_file_is_rejected(self, auth_client, entry):
        url = reverse("publications:scheme-item-list")
        resp = auth_client.post(
            url, {"entry": entry.pk, "kind": "document", "label": "X"}
        )
        assert resp.status_code == 400
        assert "document" in resp.data

    def test_filter_items_by_entry(self, auth_client, entry, db):
        other = PublicationSchemeEntry.objects.create(
            title="Other", category=PublicationSchemeEntry.Category.SERVICES
        )
        PublicationSchemeItem.objects.create(
            entry=other,
            kind=PublicationSchemeItem.Kind.LINK,
            url="https://example.gov.uk/other",
        )
        url = reverse("publications:scheme-item-list")
        resp = auth_client.get(url, {"entry": entry.pk})
        assert len(resp.data) == 1

    def test_assignee_cannot_create_items(self, db, assignee_user, entry):
        client = APIClient()
        client.force_authenticate(user=assignee_user)
        url = reverse("publications:scheme-item-list")
        resp = client.post(
            url,
            {"entry": entry.pk, "kind": "link", "url": "https://example.gov.uk/x"},
        )
        assert resp.status_code == 403
