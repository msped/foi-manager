from django.conf import settings
from django.db import models


def _scheme_upload_to(instance, filename):
    return f'publications/scheme/{filename}'


class PublicationSchemeEntry(models.Model):
    class Category(models.TextChoices):
        WHO_WE_ARE = 'who_we_are', 'Who we are and what we do'
        FINANCES = 'finances', 'What we spend and how we spend it'
        PRIORITIES = 'priorities', 'What our priorities are and how we are doing'
        DECISIONS = 'decisions', 'How we make decisions'
        POLICIES = 'policies', 'Our policies and procedures'
        LISTS_REGISTERS = 'lists_registers', 'Lists and registers'
        SERVICES = 'services', 'The services we offer'

    title = models.CharField(max_length=300)
    category = models.CharField(max_length=20, choices=Category.choices)
    description = models.TextField(blank=True)
    url = models.URLField(blank=True)
    document = models.FileField(upload_to=_scheme_upload_to, blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'title']

    def __str__(self):
        return self.title


class DisclosureLogEntry(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        REJECTED = 'rejected', 'Rejected'

    case = models.OneToOneField(
        'cases.Case',
        on_delete=models.CASCADE,
        related_name='disclosure_log_entry',
    )
    title = models.CharField(max_length=500, blank=True)
    summary = models.TextField(blank=True)
    response_text = models.TextField(blank=True)
    date_received = models.DateField(null=True, blank=True)
    date_responded = models.DateField(null=True, blank=True)
    exemptions = models.ManyToManyField(
        'cases.CaseExemption',
        blank=True,
        related_name='disclosure_log_entries',
    )
    attachments = models.ManyToManyField(
        'documents.CaseDocument',
        blank=True,
        related_name='disclosure_log_entries',
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='published_disclosure_entries',
    )
    published_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='rejected_disclosure_entries',
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='created_disclosure_entries',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_responded']

    def __str__(self):
        return f'{self.case.ref} — {self.title}'
