from datetime import date
from django.conf import settings
from django.db import models
from django.utils import timezone
from apps.cases.utils import add_working_days, working_days_between


class Department(models.Model):
    name = models.CharField(max_length=200, unique=True)
    internal_deadline_days = models.PositiveSmallIntegerField(default=10)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Case(models.Model):
    class Status(models.TextChoices):
        NEW = 'new', 'New'
        ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
        WITH_DEPARTMENT = 'with_department', 'With Department'
        DRAFTING = 'drafting', 'Drafting'
        REVIEW = 'review', 'In Review'
        WITH_APPLICANT = 'with_applicant', 'With Applicant'
        INTERNAL_REVIEW = 'internal_review', 'Internal Review'
        REFERRED = 'referred', 'Referred'
        PUBLISHED = 'published', 'Published'
        EXEMPT = 'exempt', 'Refused / Exempt'
        CLOSED = 'closed', 'Closed'

    class ReceivedBy(models.TextChoices):
        PORTAL = 'portal', 'Public Portal'
        EMAIL = 'email', 'Email'
        POST = 'post', 'Post'
        OTHER = 'other', 'Other'

    class RequesterType(models.TextChoices):
        INDIVIDUAL = 'individual', 'Individual'
        JOURNALIST = 'journalist', 'Journalist'
        BUSINESS = 'business', 'Business'
        RESEARCHER = 'researcher', 'Researcher'
        CAMPAIGN = 'campaign', 'Campaign / Advocacy Group'
        OTHER = 'other', 'Other'

    # Reference
    ref = models.CharField(max_length=20, unique=True, editable=False)

    # Requester details
    requester_name = models.CharField(max_length=300)
    requester_email = models.EmailField()
    requester_type = models.CharField(
        max_length=20, choices=RequesterType.choices, blank=True
    )
    preferred_response_format = models.CharField(max_length=50, blank=True)

    # Request content
    request_text = models.TextField()
    summary = models.TextField(blank=True)

    # Status and workflow
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.NEW
    )
    received_by = models.CharField(
        max_length=10, choices=ReceivedBy.choices, default=ReceivedBy.PORTAL
    )

    # Dates and deadlines
    submitted_at = models.DateTimeField(default=timezone.now)
    acknowledged_at = models.DateField(null=True, blank=True)
    statutory_deadline = models.DateField(null=True, blank=True)

    # Clock pause
    clock_paused = models.BooleanField(default=False)
    clock_paused_at = models.DateField(null=True, blank=True)
    clock_paused_days = models.PositiveSmallIntegerField(default=0)

    # Assignment
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='cases',
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='assigned_cases',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_cases',
    )

    # Outcome
    outcome = models.CharField(max_length=20, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f'{self.ref}: {self.request_text[:60]}'

    def save(self, *args, **kwargs):
        if not self.ref:
            self.ref = self._generate_ref()
        super().save(*args, **kwargs)

    @classmethod
    def _generate_ref(cls):
        prefix = getattr(settings, 'FOI_REFERENCE_PREFIX', 'FOI')
        year = timezone.now().year
        last = (
            cls.objects.filter(ref__startswith=f'{prefix}-{year}-')
            .order_by('-ref')
            .first()
        )
        if last:
            seq = int(last.ref.split('-')[-1]) + 1
        else:
            seq = 1
        return f'{prefix}-{year}-{seq:04d}'

    @property
    def is_overdue(self) -> bool:
        if not self.statutory_deadline:
            return False
        return date.today() > self.statutory_deadline and self.status not in (
            self.Status.PUBLISHED, self.Status.EXEMPT, self.Status.CLOSED
        )

    def acknowledge(self, actor=None):
        today = date.today()
        self.acknowledged_at = today
        self.statutory_deadline = add_working_days(today, settings.FOI_STATUTORY_DAYS)
        self.status = self.Status.ACKNOWLEDGED
        self.save()
        self._log(action='acknowledged', actor=actor, detail={})

    def pause_clock(self, reason: str = '', actor=None):
        if self.clock_paused:
            return
        self.clock_paused = True
        self.clock_paused_at = date.today()
        self.save()
        self._log(action='clock_paused', actor=actor, detail={'reason': reason})

    def resume_clock(self, actor=None):
        if not self.clock_paused or not self.clock_paused_at:
            return
        paused_days = working_days_between(self.clock_paused_at, date.today())
        self.clock_paused_days += paused_days
        self.clock_paused = False
        self.clock_paused_at = None
        if self.statutory_deadline:
            self.statutory_deadline = add_working_days(
                self.statutory_deadline, paused_days
            )
        self.save()
        self._log(action='clock_resumed', actor=actor, detail={'paused_days': paused_days})

    def transition_to(self, new_status: str, actor=None):
        old_status = self.status
        self.status = new_status
        self.save()
        self._log(
            action='status_change',
            actor=actor,
            detail={'from': old_status, 'to': new_status},
        )

    def _log(self, action: str, actor, detail: dict):
        CaseAuditEvent.objects.create(
            case=self,
            actor=actor,
            action=action,
            detail=detail,
        )


class CaseNote(models.Model):
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __repr__(self):
        return f'<CaseNote: {self.body[:40]}>'


class CaseAuditEvent(models.Model):
    case = models.ForeignKey(
        Case, on_delete=models.CASCADE, related_name='audit_events'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    action = models.CharField(max_length=50)
    detail = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f'{self.timestamp:%Y-%m-%d %H:%M} — {self.action}'
