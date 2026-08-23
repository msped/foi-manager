from datetime import timedelta

import pytest
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.cases import submissions
from apps.cases.models import Case, EmailTemplate


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
def acknowledgement_template(db):
    """Required before a case can be acknowledged.

    `acknowledge` refuses without one, and CELERY_TASK_ALWAYS_EAGER means the
    send genuinely runs during the request, so this has to be a template that
    actually renders rather than an empty row.
    """
    return EmailTemplate.objects.create(
        purpose=EmailTemplate.Purpose.ACKNOWLEDGEMENT,
        name="Acknowledgement",
        subject="We have received your request {{ref}}",
        body=(
            "Dear {{requester_name}},\n\n"
            "We received your request on {{submitted_at}} and will reply by "
            "{{statutory_deadline}}.\n\n{{organisation_name}}"
        ),
    )


@pytest.fixture
def case(db, foi_team_user):
    """A case is not routed to a department by a field on itself.

    Departments attach through CaseConsultation, which is what lets one request
    be split across several of them with its own scope and deadline each. These
    fixtures used to pass `department=` here, which stopped being a Case field
    when consultations took that over.
    """
    return Case.objects.create(
        requester_name="Jane Smith",
        requester_email="jane@example.com",
        request_text="All IT contracts over £10k.",
        created_by=foi_team_user,
    )


# ── Public submission ────────────────────────────────────────────────────────


class TestPublicCaseSubmit:
    def test_anonymous_can_submit(self, api_client, db):
        url = reverse("cases:public-submit")
        resp = api_client.post(
            url,
            {
                "requester_name": "John Public",
                "requester_email": "john@example.com",
                "request_text": "Please provide all parking enforcement data.",
            },
        )
        assert resp.status_code == 201
        assert "ref" in resp.data
        assert resp.data["ref"].startswith("FOI-")

    def test_submit_requires_name(self, api_client, db):
        url = reverse("cases:public-submit")
        resp = api_client.post(
            url,
            {
                "requester_email": "john@example.com",
                "request_text": "Parking data.",
            },
        )
        assert resp.status_code == 400

    def test_submit_requires_email(self, api_client, db):
        url = reverse("cases:public-submit")
        resp = api_client.post(
            url,
            {
                "requester_name": "John Public",
                "request_text": "Parking data.",
            },
        )
        assert resp.status_code == 400

    def test_submit_requires_request_text(self, api_client, db):
        url = reverse("cases:public-submit")
        resp = api_client.post(
            url,
            {
                "requester_name": "John Public",
                "requester_email": "john@example.com",
            },
        )
        assert resp.status_code == 400

class TestPublicSubmitAbuseControls:
    """The only unauthenticated write in the project, so the only one where
    volume is not bounded by how many staff accounts exist."""

    def payload(self, **overrides):
        return {
            "requester_name": "John Public",
            "requester_email": "john@example.com",
            "request_text": "Please provide all parking enforcement data.",
        } | overrides

    def test_filled_honeypot_is_rejected(self, api_client, db):
        url = reverse("cases:public-submit")
        resp = api_client.post(url, self.payload(website="http://spam.example"))

        assert resp.status_code == 400
        # Rejected loudly and nothing written: a silent accept-and-drop would
        # destroy a statutory request on a false positive while telling the
        # requester it had worked.
        assert Case.objects.count() == 0

    def test_empty_honeypot_is_accepted(self, api_client, db):
        url = reverse("cases:public-submit")
        resp = api_client.post(url, self.payload(website=""))

        assert resp.status_code == 201

    def test_honeypot_never_reaches_the_model(self, api_client, db):
        url = reverse("cases:public-submit")
        api_client.post(url, self.payload())

        assert not hasattr(Case.objects.get(), "website")

    def test_overlong_request_is_rejected(self, api_client, db):
        url = reverse("cases:public-submit")
        resp = api_client.post(
            url,
            self.payload(request_text="x" * (submissions.MAX_REQUEST_CHARS + 1)),
        )

        assert resp.status_code == 400
        assert Case.objects.count() == 0

    def test_request_at_the_limit_is_accepted(self, api_client, db):
        url = reverse("cases:public-submit")
        resp = api_client.post(
            url, self.payload(request_text="x" * submissions.MAX_REQUEST_CHARS)
        )

        assert resp.status_code == 201

    def test_hourly_limit_returns_429(self, api_client, db):
        url = reverse("cases:public-submit")
        for _ in range(submissions.THROTTLE_PER_HOUR):
            assert api_client.post(url, self.payload()).status_code == 201

        resp = api_client.post(url, self.payload())

        assert resp.status_code == 429
        assert Case.objects.count() == submissions.THROTTLE_PER_HOUR

    def test_throttle_says_how_to_send_the_request_anyway(self, api_client, db):
        """Unlike the tracking endpoint, this one must not stay silent. A
        request that vanishes leaves someone believing a clock has started when
        none has, so the refusal has to name the route that still works."""
        url = reverse("cases:public-submit")
        for _ in range(submissions.THROTTLE_PER_HOUR):
            api_client.post(url, self.payload())

        resp = api_client.post(url, self.payload())

        assert settings.FOI_CONTACT_EMAIL in resp.data["detail"]

    def test_case_variants_share_one_bucket(self, api_client, db):
        """Case.requester_email keeps the requester's own capitalisation, so
        without normalisation each spelling would get a limit of its own."""
        url = reverse("cases:public-submit")
        for _ in range(submissions.THROTTLE_PER_HOUR):
            api_client.post(url, self.payload(requester_email="john@example.com"))

        resp = api_client.post(url, self.payload(requester_email="John@Example.COM"))

        assert resp.status_code == 429

    def test_another_address_is_unaffected(self, api_client, db):
        url = reverse("cases:public-submit")
        for _ in range(submissions.THROTTLE_PER_HOUR):
            api_client.post(url, self.payload())

        resp = api_client.post(url, self.payload(requester_email="someone@else.com"))

        assert resp.status_code == 201

    def test_staff_logged_cases_do_not_count_towards_the_limit(
        self, api_client, db, foi_team_user
    ):
        """The ledger is portal submissions only. A requester who also phones in
        or writes must not find the web form closed because staff logged those."""
        for _ in range(submissions.THROTTLE_PER_HOUR + 1):
            Case.objects.create(
                requester_name="John Public",
                requester_email="john@example.com",
                request_text="Logged by staff from a letter.",
                received_by=Case.ReceivedBy.POST,
                created_by=foi_team_user,
            )

        resp = api_client.post(reverse("cases:public-submit"), self.payload())

        assert resp.status_code == 201

    def test_old_submissions_fall_out_of_the_window(self, api_client, db):
        url = reverse("cases:public-submit")
        for _ in range(submissions.THROTTLE_PER_HOUR):
            api_client.post(url, self.payload())
        Case.objects.all().update(submitted_at=timezone.now() - timedelta(hours=25))

        resp = api_client.post(url, self.payload())

        assert resp.status_code == 201


# ── Staff case list ──────────────────────────────────────────────────────────


class TestStaffCaseList:
    def test_foi_team_sees_all_cases(self, auth_client, case):
        url = reverse("cases:case-list")
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_unauthenticated_denied(self, api_client, case):
        url = reverse("cases:case-list")
        resp = api_client.get(url)
        assert resp.status_code == 401

    def test_assignee_sees_only_assigned(
        self, assignee_client, assignee_user, case, db, foi_team_user
    ):
        assigned_case = Case.objects.create(
            requester_name="Alice",
            requester_email="alice@example.com",
            request_text="Another request.",
            assignee=assignee_user,
            created_by=foi_team_user,
        )
        url = reverse("cases:case-list")
        resp = assignee_client.get(url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["ref"] == assigned_case.ref

    def test_filter_by_status(self, auth_client, case, foi_team_user):
        Case.objects.create(
            requester_name="Bob",
            requester_email="bob@example.com",
            request_text="Another.",
            created_by=foi_team_user,
            status=Case.Status.ACKNOWLEDGED,
        )
        url = reverse("cases:case-list")
        resp = auth_client.get(url, {"status": "new"})
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["status"] == "new"


# ── Staff case detail ────────────────────────────────────────────────────────


class TestStaffCaseDetail:
    def test_foi_team_can_retrieve(self, auth_client, case):
        url = reverse("cases:case-detail", kwargs={"pk": case.pk})
        resp = auth_client.get(url)
        assert resp.status_code == 200
        assert resp.data["ref"] == case.ref

    def test_assignee_cannot_retrieve_unassigned(self, assignee_client, case):
        url = reverse("cases:case-detail", kwargs={"pk": case.pk})
        resp = assignee_client.get(url)
        assert resp.status_code == 404
# ── Case actions ─────────────────────────────────────────────────────────────


class TestCaseAcknowledge:
    def test_acknowledge_action(self, auth_client, case, acknowledgement_template):
        url = reverse("cases:case-acknowledge", kwargs={"pk": case.pk})
        resp = auth_client.post(url)
        assert resp.status_code == 200
        case.refresh_from_db()
        assert case.status == Case.Status.ACKNOWLEDGED
        assert case.statutory_deadline is not None

    def test_acknowledge_refuses_without_a_template(self, auth_client, case):
        """The guard the test above needs the fixture to get past. Sending is
        the whole point of acknowledging, so the endpoint refuses rather than
        marking a case acknowledged and silently emailing nobody."""
        url = reverse("cases:case-acknowledge", kwargs={"pk": case.pk})
        resp = auth_client.post(url)

        assert resp.status_code == 400
        case.refresh_from_db()
        assert case.status == Case.Status.NEW

    def test_assignee_cannot_acknowledge(self, assignee_client, case):
        url = reverse("cases:case-acknowledge", kwargs={"pk": case.pk})
        resp = assignee_client.post(url)
        assert resp.status_code in (403, 404)


class TestCaseTransition:
    def test_transition_to_with_department(self, auth_client, case):
        url = reverse("cases:case-transition", kwargs={"pk": case.pk})
        resp = auth_client.post(url, {"status": "with_department"})
        assert resp.status_code == 200
        case.refresh_from_db()
        assert case.status == Case.Status.WITH_DEPARTMENT

    def test_invalid_status_rejected(self, auth_client, case):
        url = reverse("cases:case-transition", kwargs={"pk": case.pk})
        resp = auth_client.post(url, {"status": "not_a_real_status"})
        assert resp.status_code == 400
