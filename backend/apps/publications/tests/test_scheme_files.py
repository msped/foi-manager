"""Storage cleanup for scheme uploads.

`MEDIA_ROOT` is served flat and unauthenticated, and scheme documents sit at an
unguessable path rather than behind a view that checks anything. That makes
deleting the file the only way to withdraw a document — so these tests cover
the one mechanism this design has for taking something back.
"""

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient

from apps.publications.models import PublicationSchemeEntry, PublicationSchemeItem

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def isolated_media(settings, tmp_path):
    """A fresh MEDIA_ROOT per test.

    These tests assert on files being absent, which against a shared media
    directory would mean one run's leftovers deciding the next run's result.
    Changing `MEDIA_ROOT` through the `settings` fixture fires `setting_changed`,
    which is what resets `default_storage` to look at the new location.
    """
    settings.MEDIA_ROOT = tmp_path
    return tmp_path


@pytest.fixture
def auth_client(foi_team_user):
    client = APIClient()
    client.force_authenticate(user=foi_team_user)
    return client


@pytest.fixture
def entry(db):
    return PublicationSchemeEntry.objects.create(
        title="Annual accounts",
        category=PublicationSchemeEntry.Category.FINANCES,
    )


@pytest.fixture
def document_item(entry):
    item = PublicationSchemeItem.objects.create(
        entry=entry,
        kind=PublicationSchemeItem.Kind.DOCUMENT,
        label="Accounts 2025",
    )
    item.document.save("accounts-2025.pdf", ContentFile(b"%PDF-1.4 accounts"))
    return item


class TestUploadPath:
    def test_uploads_get_a_uuid_directory(self, document_item):
        """What keeps a draft entry's document off the open internet. The name
        stays readable inside it so a download still arrives sensibly named."""
        path = document_item.document.name
        assert path.startswith("publications/scheme/")
        _, _, uuid_dir, filename = path.split("/")
        assert len(uuid_dir) == 36
        assert filename == "accounts-2025.pdf"

    def test_filename_property_strips_the_uuid(self, document_item):
        assert document_item.filename == "accounts-2025.pdf"

    def test_two_uploads_of_one_name_do_not_collide(self, entry):
        first = PublicationSchemeItem.objects.create(
            entry=entry, kind=PublicationSchemeItem.Kind.DOCUMENT
        )
        first.document.save("report.pdf", ContentFile(b"one"))
        second = PublicationSchemeItem.objects.create(
            entry=entry, kind=PublicationSchemeItem.Kind.DOCUMENT
        )
        second.document.save("report.pdf", ContentFile(b"two"))

        assert first.document.name != second.document.name
        assert first.filename == second.filename == "report.pdf"


class TestDeletionRemovesTheFile:
    def test_deleting_an_item_deletes_its_file(self, document_item):
        path = document_item.document.name
        assert default_storage.exists(path)

        document_item.delete()
        assert not default_storage.exists(path)

    def test_deleting_an_entry_deletes_its_items_files(self, entry, document_item):
        """The case that matters most — a cascade must not leave documents of a
        deleted entry online with nothing left pointing at them."""
        path = document_item.document.name
        entry.delete()
        assert not default_storage.exists(path)

    def test_deleting_through_the_api_deletes_the_file(
        self, auth_client, document_item
    ):
        path = document_item.document.name
        url = reverse(
            "publications:scheme-item-detail", kwargs={"pk": document_item.pk}
        )
        assert auth_client.delete(url).status_code == 204
        assert not default_storage.exists(path)


class TestReplacementRemovesTheOldFile:
    def test_replacing_a_document_deletes_the_superseded_one(
        self, auth_client, document_item
    ):
        """The file most likely to be replaced is the one being replaced
        because it was wrong."""
        old_path = document_item.document.name
        url = reverse(
            "publications:scheme-item-detail", kwargs={"pk": document_item.pk}
        )
        resp = auth_client.patch(
            url,
            {
                "document": SimpleUploadedFile(
                    "accounts-2025.pdf",
                    b"%PDF-1.4 corrected",
                    content_type="application/pdf",
                )
            },
            format="multipart",
        )

        assert resp.status_code == 200
        document_item.refresh_from_db()
        assert document_item.document.name != old_path
        assert not default_storage.exists(old_path)
        assert default_storage.exists(document_item.document.name)

    def test_editing_a_label_leaves_the_file_alone(self, auth_client, document_item):
        path = document_item.document.name
        url = reverse(
            "publications:scheme-item-detail", kwargs={"pk": document_item.pk}
        )
        resp = auth_client.patch(url, {"label": "Accounts 2024/25"})

        assert resp.status_code == 200
        assert default_storage.exists(path)
