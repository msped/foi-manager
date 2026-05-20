from django.conf import settings
from django.core.mail import EmailMessage

from .models import EmailTemplate


def _base_context(case) -> dict:
    return {
        'ref': case.ref,
        'requester_name': case.requester_name,
        'request_text': case.request_text,
        'submitted_at': case.submitted_at.strftime('%d %B %Y') if case.submitted_at else '',
        'statutory_deadline': case.statutory_deadline.strftime('%d %B %Y') if case.statutory_deadline else '',
        'organisation_name': getattr(settings, 'ORGANISATION_NAME', 'Organisation'),
        'foi_contact_email': getattr(settings, 'FOI_CONTACT_EMAIL', settings.DEFAULT_FROM_EMAIL),
    }


def send_acknowledgement(case):
    try:
        template = EmailTemplate.objects.get(name='acknowledgement', type=EmailTemplate.Type.EMAIL)
    except EmailTemplate.DoesNotExist:
        return

    context = _base_context(case)
    subject = template.render_subject(context) or f'FOI Request Acknowledged — {case.ref}'
    body = template.render(context)

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[case.requester_email],
    )
    msg.content_subtype = 'html'
    msg.send(fail_silently=False)


def send_consultation_notification(consultation):
    if not consultation.assignee:
        return

    try:
        template = EmailTemplate.objects.get(
            name='consultation_notification', type=EmailTemplate.Type.EMAIL
        )
    except EmailTemplate.DoesNotExist:
        return

    case = consultation.case
    context = {
        **_base_context(case),
        'assignee_name': consultation.assignee.get_full_name() or consultation.assignee.email,
        'scope': consultation.scope,
        'due_date': consultation.due_date.strftime('%d %B %Y') if consultation.due_date else 'Not specified',
        'consultation_url': f"{settings.FRONTEND_URL}/consultations/{consultation.pk}",
    }
    subject = template.render_subject(context) or f'FOI Consultation Request — {case.ref}'
    body = template.render(context)

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[consultation.assignee.email],
    )
    msg.content_subtype = 'html'
    msg.send(fail_silently=False)


def send_consultation_message_notification(message):
    consultation = message.consultation
    assignee = consultation.assignee
    if not assignee or message.author == assignee:
        return

    try:
        template = EmailTemplate.objects.get(
            name='consultation_message', type=EmailTemplate.Type.EMAIL
        )
    except EmailTemplate.DoesNotExist:
        return

    case = consultation.case
    context = {
        **_base_context(case),
        'assignee_name': assignee.get_full_name() or assignee.email,
        'message_body': message.body,
        'consultation_url': f"{settings.FRONTEND_URL}/consultations/{consultation.pk}",
    }
    subject = template.render_subject(context) or f'FOI Consultation Update — {case.ref}'
    body = template.render(context)

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[assignee.email],
    )
    msg.content_subtype = 'html'
    msg.send(fail_silently=False)


def send_case_response(case_response):
    case = case_response.case

    try:
        template = EmailTemplate.objects.get(
            name='response_sent', type=EmailTemplate.Type.EMAIL
        )
    except EmailTemplate.DoesNotExist:
        return

    context = _base_context(case)
    subject = template.render_subject(context) or f'FOI Response — {case.ref}'

    rendered_body = template.render({**context, 'response_body': case_response.body})
    case_response.rendered_body = rendered_body
    case_response.save(update_fields=['rendered_body'])

    msg = EmailMessage(
        subject=subject,
        body=rendered_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[case.requester_email],
    )
    msg.content_subtype = 'html'
    msg.send(fail_silently=False)
