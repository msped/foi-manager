from datetime import date
from django.conf import settings
from django.db import models
from django.utils import timezone
from apps.cases.utils import add_working_days, working_days_between


class BankHoliday(models.Model):
    class Country(models.TextChoices):
        ENGLAND = 'england', 'England'
        WALES = 'wales', 'Wales'
        SCOTLAND = 'scotland', 'Scotland'
        NORTHERN_IRELAND = 'northern_ireland', 'Northern Ireland'

    country = models.CharField(max_length=20, choices=Country.choices)
    name = models.CharField(max_length=100)
    date = models.DateField()

    class Meta:
        ordering = ['date', 'country']
        unique_together = [['date', 'country']]

    def __str__(self):
        return f'{self.date} — {self.name} ({self.get_country_display()})'


class RequesterCategory(models.Model):
    name = models.CharField(max_length=100, unique=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'name']
        verbose_name_plural = 'requester categories'

    def __str__(self):
        return self.name


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

    # Reference
    ref = models.CharField(max_length=20, unique=True, editable=False)

    # Requester details
    requester_name = models.CharField(max_length=300)
    requester_email = models.EmailField()
    requester_type = models.CharField(max_length=100, blank=True)
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

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_cases',
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='assigned_cases',
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
        if not self.statutory_deadline and self.submitted_at:
            submitted_date = self.submitted_at.date() if hasattr(self.submitted_at, 'date') else self.submitted_at
            self.statutory_deadline = add_working_days(submitted_date, settings.FOI_STATUTORY_DAYS)
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


class Mailbox(models.Model):
    name = models.CharField(max_length=200, unique=True)
    email = models.EmailField(unique=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'mailboxes'

    def __str__(self):
        return f'{self.name} <{self.email}>'


class EmailTemplate(models.Model):
    class Type(models.TextChoices):
        EMAIL = 'email', 'Email'
        RESPONSE = 'response', 'Response Template'

    name = models.CharField(max_length=200, unique=True)
    type = models.CharField(max_length=20, choices=Type.choices)
    description = models.TextField(blank=True)
    subject = models.CharField(max_length=500, blank=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['type', 'name']

    def __str__(self):
        return f'[{self.get_type_display()}] {self.name}'

    def render(self, context: dict) -> str:
        result = self.body
        for key, value in context.items():
            result = result.replace(f'{{{{{key}}}}}', str(value))
        return result

    def render_subject(self, context: dict) -> str:
        result = self.subject
        for key, value in context.items():
            result = result.replace(f'{{{{{key}}}}}', str(value))
        return result


class CaseConsultation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        AWAITING_CLARIFICATION = 'awaiting_clarification', 'Awaiting Clarification'
        RESPONDED = 'responded', 'Responded'
        WITHDRAWN = 'withdrawn', 'Withdrawn'

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='consultations')
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='consultations',
    )
    mailbox = models.ForeignKey(
        Mailbox, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='consultations',
    )
    scope = models.TextField()
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING)
    due_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_consultations',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        recipient = (
            self.assignee.get_full_name() if self.assignee
            else self.mailbox.name if self.mailbox
            else 'Unassigned'
        )
        return f'{self.case.ref} → {recipient}'


class ConsultationMessage(models.Model):
    consultation = models.ForeignKey(
        CaseConsultation, on_delete=models.CASCADE, related_name='messages'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.consultation} — {self.created_at:%Y-%m-%d %H:%M}'


class CaseResponse(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SENT = 'sent', 'Sent'

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='responses')
    body = models.TextField()
    rendered_body = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='created_responses',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.case.ref} response ({self.status})'


class CaseExemption(models.Model):
    class Code(models.TextChoices):
        S12_COST_LIMIT = 's12', 's.12 — Cost of compliance limit'
        S14_VEXATIOUS = 's14', 's.14 — Vexatious or repeated request'
        S21_PUBLICLY_AVAILABLE = 's21', 's.21 — Information accessible by other means'
        S22_FUTURE_PUBLICATION = 's22', 's.22 — Intended for future publication'
        S23_SECURITY_BODIES = 's23', 's.23 — Information supplied by security bodies'
        S24_NATIONAL_SECURITY = 's24', 's.24 — National security'
        S26_DEFENCE = 's26', 's.26 — Defence'
        S27_INTERNATIONAL_RELATIONS = 's27', 's.27 — International relations'
        S28_RELATIONS_WITHIN_UK = 's28', 's.28 — Relations within the UK'
        S29_ECONOMY = 's29', 's.29 — The economy'
        S30_INVESTIGATIONS = 's30', 's.30 — Investigations and proceedings'
        S31_LAW_ENFORCEMENT = 's31', 's.31 — Law enforcement'
        S32_COURT_RECORDS = 's32', 's.32 — Court records'
        S33_AUDIT = 's33', 's.33 — Audit functions'
        S34_PARLIAMENTARY_PRIVILEGE = 's34', 's.34 — Parliamentary privilege'
        S35_POLICY_FORMULATION = 's35', 's.35 — Formulation of government policy'
        S36_PREJUDICE = 's36', 's.36 — Prejudice to effective conduct of public affairs'
        S37_COMMUNICATIONS = 's37', 's.37 — Communications with the Crown'
        S38_HEALTH_AND_SAFETY = 's38', 's.38 — Health and safety'
        S39_ENVIRONMENTAL = 's39', 's.39 — Environmental information'
        S40_PERSONAL_INFO = 's40', 's.40 — Personal information'
        S41_CONFIDENTIAL = 's41', 's.41 — Information provided in confidence'
        S42_LEGAL_PRIVILEGE = 's42', 's.42 — Legal professional privilege'
        S43_COMMERCIAL = 's43', 's.43 — Commercial interests'
        S44_PROHIBITIONS = 's44', 's.44 — Prohibitions on disclosure'

    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='exemptions')
    code = models.CharField(max_length=10, choices=Code.choices)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']
        unique_together = [['case', 'code']]

    def __str__(self):
        return f'{self.code} — {self.case.ref}'


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
