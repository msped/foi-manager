import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.documents.models import CaseDocument


@pytest.fixture
def department(db):
    from apps.cases.models import Department

    return Department.objects.create(name="IT")


@pytest.fixture
def case(db, foi_team_user, department):
    from apps.cases.models import Case

    return Case.objects.create(
        requester_name="Jane Smith",
        requester_email="jane@example.com",
        request_text="All IT contracts over £10k.",
        department=department,
        created_by=foi_team_user,
    )


@pytest.fixture
def pdf_file():
    return SimpleUploadedFile(
        "response.pdf", b"%PDF-1.4 fake content", content_type="application/pdf"
    )


class TestCaseDocument:
    def test_create_document(self, db, case, foi_team_user, pdf_file):
        doc = CaseDocument.objects.create(
            case=case,
            file=pdf_file,
            original_filename="response.pdf",
            uploaded_by=foi_team_user,
        )
        assert doc.pk is not None

    def test_is_not_public_by_default(self, db, case, foi_team_user, pdf_file):
        doc = CaseDocument.objects.create(
            case=case,
            file=pdf_file,
            original_filename="internal.pdf",
            uploaded_by=foi_team_user,
        )
        assert doc.is_public is False

    def test_can_be_marked_public(self, db, case, foi_team_user, pdf_file):
        doc = CaseDocument.objects.create(
            case=case,
            file=pdf_file,
            original_filename="response.pdf",
            uploaded_by=foi_team_user,
            is_public=True,
        )
        assert doc.is_public is True

    def test_str(self, db, case, foi_team_user, pdf_file):
        doc = CaseDocument.objects.create(
            case=case,
            file=pdf_file,
            original_filename="response.pdf",
            uploaded_by=foi_team_user,
        )
        assert "response.pdf" in str(doc)

    def test_ordering_newest_first(self, db, case, foi_team_user):
        f1 = SimpleUploadedFile("a.pdf", b"a", content_type="application/pdf")
        f2 = SimpleUploadedFile("b.pdf", b"b", content_type="application/pdf")
        CaseDocument.objects.create(
            case=case, file=f1, original_filename="a.pdf", uploaded_by=foi_team_user
        )
        CaseDocument.objects.create(
            case=case, file=f2, original_filename="b.pdf", uploaded_by=foi_team_user
        )
        docs = list(case.documents.all())
        assert docs[0].original_filename == "b.pdf"
