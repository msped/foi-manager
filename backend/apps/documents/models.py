from django.conf import settings
from django.db import models


def _upload_to(instance, filename):
    return f'cases/{instance.case_id}/documents/{filename}'


def _attachment_upload_to(instance, filename):
    if instance.consultation_message_id:
        return f'attachments/consultations/{instance.consultation_message_id}/{filename}'
    if instance.case_response_id:
        return f'attachments/responses/{instance.case_response_id}/{filename}'
    return f'attachments/misc/{filename}'


class CaseDocument(models.Model):
    case = models.ForeignKey(
        'cases.Case', on_delete=models.CASCADE, related_name='documents'
    )
    file = models.FileField(upload_to=_upload_to)
    original_filename = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    is_public = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.original_filename


class Attachment(models.Model):
    consultation_message = models.ForeignKey(
        'cases.ConsultationMessage', null=True, blank=True,
        on_delete=models.CASCADE, related_name='attachments',
    )
    case_response = models.ForeignKey(
        'cases.CaseResponse', null=True, blank=True,
        on_delete=models.CASCADE, related_name='attachments',
    )
    file = models.FileField(upload_to=_attachment_upload_to)
    original_filename = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.original_filename
