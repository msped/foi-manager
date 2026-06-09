import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient

from apps.cases.models import Case, Department
from apps.documents.models import CaseDocument


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
    return Department.objects.create(name="IT")


@pytest.fixture
def case(db, foi_team_user, department):
    return Case.objects.create(
        requester_name="Jane Smith",
        requester_email="jane@example.com",
        request_text="All IT contracts.",
        department=department,
        created_by=foi_team_user,
    )


@pytest.fixture
def assigned_case(db, foi_team_user, assignee_user, department):
    return Case.objects.create(
        requester_name="Bob",
        requester_email="bob@example.com",
        request_text="Assigned case.",
        department=department,
        created_by=foi_team_user,
        assignee=assignee_user,
    )


class TestDocumentUpload:
    def test_foi_team_can_upload(self, auth_client, case):
        url = reverse("documents:case-documents-list", kwargs={"case_pk": case.pk})
        pdf = SimpleUploadedFile(
            "response.pdf", b"%PDF fake", content_type="application/pdf"
        )
        resp = auth_client.post(
            url, {"file": pdf, "original_filename": "response.pdf"}, format="multipart"
        )
        assert resp.status_code == 201
        assert CaseDocument.objects.filter(case=case).count() == 1

    def test_assignee_can_upload_to_assigned_case(self, assignee_client, assigned_case):
        url = reverse(
            "documents:case-documents-list", kwargs={"case_pk": assigned_case.pk}
        )
        pdf = SimpleUploadedFile(
            "info.pdf", b"%PDF info", content_type="application/pdf"
        )
        resp = assignee_client.post(
            url, {"file": pdf, "original_filename": "info.pdf"}, format="multipart"
        )
        assert resp.status_code == 201

    def test_assignee_cannot_upload_to_unassigned_case(self, assignee_client, case):
        url = reverse("documents:case-documents-list", kwargs={"case_pk": case.pk})
        pdf = SimpleUploadedFile("x.pdf", b"%PDF x", content_type="application/pdf")
        resp = assignee_client.post(
            url, {"file": pdf, "original_filename": "x.pdf"}, format="multipart"
        )
        assert resp.status_code == 404

    def test_anonymous_cannot_upload(self, api_client, case):
        url = reverse("documents:case-documents-list", kwargs={"case_pk": case.pk})
        pdf = SimpleUploadedFile("x.pdf", b"%PDF x", content_type="application/pdf")
        resp = api_client.post(
            url, {"file": pdf, "original_filename": "x.pdf"}, format="multipart"
        )
        assert resp.status_code == 401


class TestDocumentList:
    def test_foi_team_can_list(self, auth_client, case, foi_team_user):
        pdf = SimpleUploadedFile("a.pdf", b"%PDF a", content_type="application/pdf")
        CaseDocument.objects.create(
            case=case, file=pdf, original_filename="a.pdf", uploaded_by=foi_team_user
        )
        url = reverse("documents:case-documents-list", kwargs={"case_pk": case.pk})
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_assignee_can_list_assigned_case_docs(
        self, assignee_client, assigned_case, foi_team_user
    ):
        pdf = SimpleUploadedFile("b.pdf", b"%PDF b", content_type="application/pdf")
        CaseDocument.objects.create(
            case=assigned_case,
            file=pdf,
            original_filename="b.pdf",
            uploaded_by=foi_team_user,
        )
        url = reverse(
            "documents:case-documents-list", kwargs={"case_pk": assigned_case.pk}
        )
        resp = assignee_client.get(url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1


class TestDocumentVisibility:
    def test_foi_team_can_mark_public(self, auth_client, case, foi_team_user):
        pdf = SimpleUploadedFile("resp.pdf", b"%PDF r", content_type="application/pdf")
        doc = CaseDocument.objects.create(
            case=case, file=pdf, original_filename="resp.pdf", uploaded_by=foi_team_user
        )
        url = reverse(
            "documents:case-documents-detail", kwargs={"case_pk": case.pk, "pk": doc.pk}
        )
        resp = auth_client.patch(url, {"is_public": True})
        assert resp.status_code == 200
        doc.refresh_from_db()
        assert doc.is_public is True
