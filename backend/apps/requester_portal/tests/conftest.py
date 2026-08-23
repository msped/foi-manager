import pytest
from rest_framework.test import APIClient

from apps.cases.models import Case


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def case(db):
    return Case.objects.create(
        requester_name="Jane Smith",
        # Mixed case on purpose: Case.requester_email preserves whatever the
        # requester typed, and several tests here exist to prove that the portal
        # copes with that rather than assuming addresses arrive lowercased.
        requester_email="Jane.Smith@Example.com",
        request_text="All IT contracts over £10k.",
    )
