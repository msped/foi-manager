from django.conf import settings
from django.core.mail import EmailMessage

from .models import CaseAuditEvent, EmailTemplate


def _audit(case, action: str, detail: dict):
    CaseAuditEvent.objects.create(case=case, actor=None, action=action, detail=detail)


def _base_context(case) -> dict:
    return {
        "ref": case.ref,
        "requester_name": case.requester_name,
        "request_text": case.request_text,
        "submitted_at": case.submitted_at.strftime("%d %B %Y")
        if case.submitted_at
        else "",
        "statutory_deadline": case.statutory_deadline.strftime("%d %B %Y")
        if case.statutory_deadline
        else "",
        "organisation_name": getattr(settings, "ORGANISATION_NAME", "Organisation"),
        "foi_contact_email": getattr(
            settings, "FOI_CONTACT_EMAIL", settings.DEFAULT_FROM_EMAIL
        ),
    }


def _get_template(purpose: str) -> EmailTemplate:
    try:
        return EmailTemplate.objects.get(purpose=purpose)
    except EmailTemplate.DoesNotExist:
        label = EmailTemplate.PURPOSE_META[purpose]["label"]
        raise ValueError(
            f'The "{label}" email template is not configured. '
            "Set it up in Settings → Email Templates before continuing."
        )


def send_acknowledgement(case):
    template = _get_template(EmailTemplate.Purpose.ACKNOWLEDGEMENT)

    context = _base_context(case)
    subject = (
        template.render_subject(context) or f"FOI Request Acknowledged — {case.ref}"
    )
    body = template.render(context)

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[case.requester_email],
    )
    msg.content_subtype = "html"
    msg.send(fail_silently=False)
    _audit(case, "email_sent", {"type": "acknowledgement", "to": case.requester_email})


def send_consultation_notification(consultation):
    if not consultation.assignee:
        return

    template = _get_template(EmailTemplate.Purpose.CONSULTATION_NOTIFICATION)

    case = consultation.case
    context = {
        **_base_context(case),
        "assignee_name": consultation.assignee.get_full_name()
        or consultation.assignee.email,
        "scope": consultation.scope,
        "due_date": consultation.due_date.strftime("%d %B %Y")
        if consultation.due_date
        else "Not specified",
        "consultation_url": f"{settings.FRONTEND_URL}/consultations/{consultation.pk}",
    }
    subject = (
        template.render_subject(context) or f"FOI Consultation Request — {case.ref}"
    )
    body = template.render(context)

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[consultation.assignee.email],
    )
    msg.content_subtype = "html"
    msg.send(fail_silently=False)
    _audit(
        case,
        "email_sent",
        {
            "type": "consultation_notification",
            "to": consultation.assignee.email,
            "consultation_id": consultation.pk,
        },
    )


def send_consultation_message_notification(message):
    consultation = message.consultation
    assignee = consultation.assignee
    if not assignee or message.author == assignee:
        return

    template = _get_template(EmailTemplate.Purpose.CONSULTATION_MESSAGE)

    case = consultation.case
    context = {
        **_base_context(case),
        "assignee_name": assignee.get_full_name() or assignee.email,
        "message_body": message.body,
        "consultation_url": f"{settings.FRONTEND_URL}/consultations/{consultation.pk}",
    }
    subject = (
        template.render_subject(context) or f"FOI Consultation Update — {case.ref}"
    )
    body = template.render(context)

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[assignee.email],
    )
    msg.content_subtype = "html"
    msg.send(fail_silently=False)
    _audit(
        case,
        "email_sent",
        {
            "type": "consultation_message",
            "to": assignee.email,
            "consultation_id": consultation.pk,
        },
    )


def send_case_assignment_notification(case, assignee):
    try:
        prefs = assignee.notification_preferences
        if not prefs.notify_on_case_assignment:
            return
    except Exception:
        pass

    template = _get_template(EmailTemplate.Purpose.CASE_ASSIGNMENT)

    context = {
        **_base_context(case),
        "assignee_name": assignee.get_full_name() or assignee.email,
        "case_url": f"{settings.FRONTEND_URL}/cases/{case.pk}",
    }
    subject = (
        template.render_subject(context) or f"FOI Case Assigned to You — {case.ref}"
    )
    body = template.render(context)

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[assignee.email],
    )
    msg.content_subtype = "html"
    msg.send(fail_silently=False)
    _audit(case, "email_sent", {"type": "case_assignment", "to": assignee.email})


def send_case_response(case_response):
    template = _get_template(EmailTemplate.Purpose.CASE_RESPONSE)

    case = case_response.case
    context = {
        **_base_context(case),
        "response_body": case_response.body,
    }
    subject = (
        template.render_subject(context)
        or f"Freedom of Information Response — {case.ref}"
    )
    body = template.render(context)

    case_response.rendered_body = body
    case_response.save(update_fields=["rendered_body"])

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[case.requester_email],
    )
    msg.content_subtype = "html"
    msg.send(fail_silently=False)
    _audit(case, "email_sent", {"type": "response", "to": case.requester_email})
