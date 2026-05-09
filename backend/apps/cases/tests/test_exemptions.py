import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from apps.cases.models import Case, CaseExemption, Department


@pytest.fixture
def auth_client(foi_team_user):
    client = APIClient()
    client.force_authenticate(user=foi_team_user)
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


class TestCaseExemptionModel:
    def test_create_exemption(self, db, case):
        exemption = CaseExemption.objects.create(
            case=case,
            code=CaseExemption.Code.S40_PERSONAL_INFO,
        )
        assert exemption.pk is not None

    def test_str_includes_code(self, db, case):
        exemption = CaseExemption.objects.create(
            case=case,
            code=CaseExemption.Code.S40_PERSONAL_INFO,
        )
        assert 's40' in str(exemption)

    def test_all_uk_foia_codes_present(self):
        codes = [c.value for c in CaseExemption.Code]
        assert 's12' in codes  # cost limit
        assert 's14' in codes  # vexatious
        assert 's21' in codes  # publicly available
        assert 's40' in codes  # personal info
        assert 's41' in codes  # confidential
        assert 's42' in codes  # legal privilege
        assert 's43' in codes  # commercial interests


class TestCaseExemptionAPI:
    def test_foi_team_can_add_exemption(self, auth_client, case):
        url = reverse('cases:case-exemptions-list', kwargs={'case_pk': case.pk})
        resp = auth_client.post(url, {'code': 's40', 'notes': 'Contains personal data.'})
        assert resp.status_code == 201
        assert CaseExemption.objects.filter(case=case).count() == 1

    def test_foi_team_can_list_exemptions(self, auth_client, case):
        CaseExemption.objects.create(case=case, code='s40')
        CaseExemption.objects.create(case=case, code='s41')
        url = reverse('cases:case-exemptions-list', kwargs={'case_pk': case.pk})
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data['count'] == 2

    def test_foi_team_can_remove_exemption(self, auth_client, case):
        exemption = CaseExemption.objects.create(case=case, code='s40')
        url = reverse('cases:case-exemptions-detail', kwargs={'case_pk': case.pk, 'pk': exemption.pk})
        resp = auth_client.delete(url)
        assert resp.status_code == 204
        assert not CaseExemption.objects.filter(pk=exemption.pk).exists()

    def test_invalid_code_rejected(self, auth_client, case):
        url = reverse('cases:case-exemptions-list', kwargs={'case_pk': case.pk})
        resp = auth_client.post(url, {'code': 'not_a_real_section'})
        assert resp.status_code == 400

    def test_assignee_cannot_add_exemption(self, db, assignee_user, case):
        client = APIClient()
        client.force_authenticate(user=assignee_user)
        url = reverse('cases:case-exemptions-list', kwargs={'case_pk': case.pk})
        resp = client.post(url, {'code': 's40'})
        assert resp.status_code in (403, 404)
