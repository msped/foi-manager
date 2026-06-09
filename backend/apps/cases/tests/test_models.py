import pytest

from apps.cases.models import Case, CaseNote, Department


@pytest.fixture
def department(db):
    return Department.objects.create(name="IT", internal_deadline_days=10)


@pytest.fixture
def case(db, foi_team_user, department):
    return Case.objects.create(
        requester_name="Jane Smith",
        requester_email="jane@example.com",
        request_text="Please provide all IT contracts over £10,000.",
        department=department,
        created_by=foi_team_user,
    )


class TestDepartment:
    def test_str(self, department):
        assert str(department) == "IT"

    def test_default_internal_deadline(self, db):
        dept = Department.objects.create(name="Legal")
        assert dept.internal_deadline_days == 10

    def test_custom_internal_deadline(self, db):
        dept = Department.objects.create(name="Planning", internal_deadline_days=20)
        assert dept.internal_deadline_days == 20


class TestCaseCreation:
    def test_ref_is_generated(self, case):
        assert case.ref.startswith("FOI-")

    def test_ref_format(self, case):
        # FOI-YYYY-NNNN
        parts = case.ref.split("-")
        assert len(parts) == 3
        assert parts[0] == "FOI"
        assert len(parts[1]) == 4  # year
        assert len(parts[2]) == 4  # zero-padded sequence

    def test_default_status_is_new(self, case):
        assert case.status == Case.Status.NEW

    def test_str(self, case):
        assert case.ref in str(case)

    def test_no_deadline_until_acknowledged(self, case):
        assert case.statutory_deadline is None

    def test_is_overdue_false_when_no_deadline(self, case):
        assert case.is_overdue is False


class TestCaseAcknowledgement:
    def test_acknowledge_sets_deadline(self, case):
        case.acknowledge()
        assert case.statutory_deadline is not None

    def test_acknowledge_sets_status(self, case):
        case.acknowledge()
        assert case.status == Case.Status.ACKNOWLEDGED

    def test_deadline_is_20_working_days(self, case):
        case.acknowledge()
        from apps.cases.utils import working_days_between

        days = working_days_between(case.acknowledged_at, case.statutory_deadline)
        assert days == 20

    def test_acknowledge_creates_audit_event(self, case, foi_team_user):
        case.acknowledge(actor=foi_team_user)
        assert case.audit_events.filter(action="acknowledged").exists()


class TestClockPause:
    def test_pause_clock(self, case):
        case.acknowledge()
        case.pause_clock(reason="Awaiting clarification from requester")
        assert case.clock_paused is True

    def test_resume_clock(self, case):
        case.acknowledge()
        case.pause_clock(reason="Awaiting clarification")
        case.resume_clock()
        assert case.clock_paused is False

    def test_resume_extends_deadline(self, case):
        case.acknowledge()
        original_deadline = case.statutory_deadline
        case.pause_clock(reason="Awaiting clarification")
        case.resume_clock()
        assert case.statutory_deadline >= original_deadline


class TestCaseNote:
    def test_create_note(self, case, foi_team_user):
        note = CaseNote.objects.create(
            case=case,
            author=foi_team_user,
            body="Chased department for information.",
        )
        assert note.pk is not None
        assert str(note.body) in repr(note)

    def test_note_ordering(self, case, foi_team_user):
        CaseNote.objects.create(case=case, author=foi_team_user, body="First note")
        CaseNote.objects.create(case=case, author=foi_team_user, body="Second note")
        notes = list(case.notes.all())
        assert notes[0].body == "First note"
        assert notes[1].body == "Second note"


class TestCaseAuditEvent:
    def test_audit_event_created_on_status_change(self, case, foi_team_user):
        case.transition_to(Case.Status.ACKNOWLEDGED, actor=foi_team_user)
        assert case.audit_events.filter(action="status_change").exists()

    def test_audit_event_records_actor(self, case, foi_team_user):
        case.transition_to(Case.Status.ACKNOWLEDGED, actor=foi_team_user)
        event = case.audit_events.get(action="status_change")
        assert event.actor == foi_team_user

    def test_audit_event_records_old_and_new_status(self, case, foi_team_user):
        old_status = case.status
        case.transition_to(Case.Status.ACKNOWLEDGED, actor=foi_team_user)
        event = case.audit_events.get(action="status_change")
        assert event.detail["from"] == old_status
        assert event.detail["to"] == Case.Status.ACKNOWLEDGED
