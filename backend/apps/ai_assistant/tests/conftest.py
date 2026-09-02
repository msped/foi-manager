import pytest
from django.utils import timezone

from apps.ai_assistant.indexing import embed_case, embed_disclosure_entry
from apps.cases.models import Case
from apps.publications.models import DisclosureLogEntry

# The stub embedder ranks by shared vocabulary, not meaning — it has no idea
# that "agency staff" and "staffing costs" are related, and it does notice that
# two unrelated questions both start with "How many". So these fixtures are
# written with the lexical overlap pointing the same way as the intended
# relationship: AGENCY and STAFFING share most of their content words, and
# POTHOLES shares only the grammatical scaffolding.
#
# That is a property of the test double, not of retrieval. What these fixtures
# can prove is that the query orders by distance and applies its filters. What
# they cannot prove is that nomic-embed-text finds the right neighbours; that
# needs the golden set, against the real model.
AGENCY = (
    "How much did the council spend on agency staff and temporary staff "
    "last financial year?"
)
STAFFING = (
    "Please provide the council spend on agency staff and temporary staff, "
    "broken down by department."
)
POTHOLES = "How many potholes were reported and repaired on adopted highways?"


@pytest.fixture
def make_case(db):
    def _make(request_text, *, email="requester@example.com", days_ago=0, **kwargs):
        case = Case.objects.create(
            requester_name=kwargs.pop("requester_name", "A Requester"),
            requester_email=email,
            request_text=request_text,
            submitted_at=timezone.now() - timezone.timedelta(days=days_ago),
            **kwargs,
        )
        # Indexing is asynchronous in the running service; done inline here so
        # a test asserting on ranking is not also asserting on Celery.
        embed_case(case.pk)
        return case

    return _make


@pytest.fixture
def make_entry(db, foi_team_user):
    def _make(case, title, summary, response_text="", **kwargs):
        entry = DisclosureLogEntry.objects.create(
            case=case,
            title=title,
            summary=summary,
            response_text=response_text,
            status=kwargs.pop("status", DisclosureLogEntry.Status.PUBLISHED),
            date_responded=kwargs.pop("date_responded", timezone.localdate()),
            created_by=foi_team_user,
            **kwargs,
        )
        embed_disclosure_entry(entry.pk)
        return entry

    return _make
