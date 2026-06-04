from config.celery import app
from django.utils import timezone


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_acknowledgement(self, case_id: int):
    from .email_utils import send_acknowledgement
    from .models import Case
    try:
        case = Case.objects.get(pk=case_id)
        send_acknowledgement(case)
    except Exception as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_consultation_notification(self, consultation_id: int):
    from .email_utils import send_consultation_notification
    from .models import CaseConsultation
    try:
        consultation = CaseConsultation.objects.select_related('assignee', 'case').get(pk=consultation_id)
        send_consultation_notification(consultation)
    except Exception as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_consultation_message_notification(self, message_id: int):
    from .email_utils import send_consultation_message_notification
    from .models import ConsultationMessage
    try:
        message = ConsultationMessage.objects.select_related(
            'consultation__assignee', 'consultation__case', 'author'
        ).get(pk=message_id)
        send_consultation_message_notification(message)
    except Exception as exc:
        raise self.retry(exc=exc)


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def task_send_case_response(self, case_response_id: int):
    from .email_utils import send_case_response
    from .models import CaseResponse
    try:
        from .models import Case
        case_response = CaseResponse.objects.select_related('case').get(pk=case_response_id)
        send_case_response(case_response)
        case_response.sent_at = timezone.now()
        case_response.status = CaseResponse.Status.SENT
        case_response.save(update_fields=['sent_at', 'status'])
        case = case_response.case
        case.transition_to(Case.Status.CLOSED)
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            from .models import CaseResponse as CR
            CR.objects.filter(pk=case_response_id).update(status=CR.Status.FAILED)
        raise self.retry(exc=exc)
