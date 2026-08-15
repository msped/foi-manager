import re

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils.html import escape

from .models import CaseAuditEvent, EmailTemplate

#: Marks where the officer's content begins in a seeded response draft. The
#: frontend strips this and places the caret there. Deliberately brace-free so
#: it cannot be mistaken for an unresolved {{variable}} at send time.
CARET_SENTINEL = "⟦FOI-CARET⟧"

UNRESOLVED_VARIABLE_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def substitute(text: str, context: dict) -> str:
    """Replace {{key}} tokens in an arbitrary string. Mirrors EmailTemplate.render."""
    for key, value in context.items():
        text = text.replace(f"{{{{{key}}}}}", str(value))
    return text


def unresolved_variables(text: str) -> list[str]:
    """Return any {{variable}} tokens still present, in first-seen order."""
    seen = []
    for name in UNRESOLVED_VARIABLE_RE.findall(text):
        if name not in seen:
            seen.append(name)
    return seen


def _as_html(text: str) -> str:
    """Make plain-text case data safe to embed in an HTML email body.

    Requests arrive as plain text from the portal or are pasted in by staff, so
    they carry no markup and their line breaks are significant.
    """
    return escape(text or "").replace("\n", "<br>")


def _audit(case, action: str, detail: dict):
    CaseAuditEvent.objects.create(case=case, actor=None, action=action, detail=detail)


def _base_context(case) -> dict:
    return {
        "ref": case.ref,
        "requester_name": case.requester_name,
        "request_text": _as_html(case.request_text),
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


def _send_email(
    purpose: str,
    to: str,
    case,
    context: dict,
    default_subject: str,
    audit_type: str,
    audit_extra: dict | None = None,
) -> str:
    """Render and send a purpose-driven email. Returns the rendered body."""
    template = _get_template(purpose)
    subject = template.render_subject(context) or default_subject
    body = template.render(context)
    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[to],
    )
    msg.content_subtype = "html"
    msg.send(fail_silently=False)
    _audit(case, "email_sent", {"type": audit_type, "to": to, **(audit_extra or {})})
    return body


def send_acknowledgement(case):
    _send_email(
        purpose=EmailTemplate.Purpose.ACKNOWLEDGEMENT,
        to=case.requester_email,
        case=case,
        context=_base_context(case),
        default_subject=f"FOI Request Acknowledged — {case.ref}",
        audit_type="acknowledgement",
    )


def send_clarification_request(case, body: str):
    _send_email(
        purpose=EmailTemplate.Purpose.CLARIFICATION_REQUEST,
        to=case.requester_email,
        case=case,
        context={**_base_context(case), "clarification_body": body},
        default_subject=f"Clarification Required — FOI Request {case.ref}",
        audit_type="clarification_request",
    )


def build_response_seed(case) -> dict:
    """Seed payload for a new response draft.

    The case_response template supplies the whole letter, with {{response_body}}
    swapped for the caret sentinel. Response blocks are pre-rendered here so the
    frontend can insert them without a second substitution implementation.
    """
    from .models import ResponseTemplate

    context = _base_context(case)
    template = EmailTemplate.objects.filter(
        purpose=EmailTemplate.Purpose.CASE_RESPONSE
    ).first()

    if template:
        body = substitute(template.body, context).replace(
            "{{response_body}}", CARET_SENTINEL
        )
        subject = substitute(template.subject, context)
    else:
        body = ""
        subject = ""

    claimed = set(case.exemptions.values_list("code", flat=True))
    blocks = [
        {
            "id": block.id,
            "name": block.name,
            "exemption_code": block.exemption_code,
            "body": substitute(block.body, context),
            "suggested": bool(block.exemption_code)
            and block.exemption_code in claimed,
        }
        for block in ResponseTemplate.objects.all()
    ]

    return {
        "body": body,
        "subject": subject or _default_response_subject(case),
        "template_configured": template is not None,
        "blocks": blocks,
    }


def _default_response_subject(case) -> str:
    return f"Freedom of Information Response — {case.ref}"


def send_case_response(case_response):
    """Send the officer-authored letter verbatim.

    The case_response template seeds the draft at creation; it does not wrap the
    body at send time. Only the subject line still comes from the template.
    """
    case = case_response.case
    context = _base_context(case)
    template = EmailTemplate.objects.filter(
        purpose=EmailTemplate.Purpose.CASE_RESPONSE
    ).first()

    body = case_response.body.replace(CARET_SENTINEL, "")
    subject = (
        substitute(template.subject, context) if template else ""
    ) or _default_response_subject(case)

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[case.requester_email],
    )
    msg.content_subtype = "html"
    msg.send(fail_silently=False)

    _audit(case, "email_sent", {"type": "response", "to": case.requester_email})
    case_response.rendered_body = body
    case_response.save(update_fields=["rendered_body"])


def send_consultation_notification(consultation):
    if not consultation.assignee:
        return
    case = consultation.case
    _send_email(
        purpose=EmailTemplate.Purpose.CONSULTATION_NOTIFICATION,
        to=consultation.assignee.email,
        case=case,
        context={
            **_base_context(case),
            "assignee_name": consultation.assignee.get_full_name() or consultation.assignee.email,
            "scope": consultation.scope,
            "due_date": consultation.due_date.strftime("%d %B %Y") if consultation.due_date else "Not specified",
            "consultation_url": f"{settings.FRONTEND_URL}/consultations/{consultation.pk}",
        },
        default_subject=f"FOI Consultation Request — {case.ref}",
        audit_type="consultation_notification",
        audit_extra={"consultation_id": consultation.pk},
    )


def send_consultation_message_notification(message):
    consultation = message.consultation
    assignee = consultation.assignee
    if not assignee or message.author == assignee:
        return
    case = consultation.case
    _send_email(
        purpose=EmailTemplate.Purpose.CONSULTATION_MESSAGE,
        to=assignee.email,
        case=case,
        context={
            **_base_context(case),
            "assignee_name": assignee.get_full_name() or assignee.email,
            "message_body": message.body,
            "consultation_url": f"{settings.FRONTEND_URL}/consultations/{consultation.pk}",
        },
        default_subject=f"FOI Consultation Update — {case.ref}",
        audit_type="consultation_message",
        audit_extra={"consultation_id": consultation.pk},
    )


def send_case_assignment_notification(case, assignee):
    try:
        prefs = assignee.notification_preferences
        if not prefs.notify_on_case_assignment:
            return
    except Exception:
        pass
    _send_email(
        purpose=EmailTemplate.Purpose.CASE_ASSIGNMENT,
        to=assignee.email,
        case=case,
        context={
            **_base_context(case),
            "assignee_name": assignee.get_full_name() or assignee.email,
            "case_url": f"{settings.FRONTEND_URL}/cases/{case.pk}",
        },
        default_subject=f"FOI Case Assigned to You — {case.ref}",
        audit_type="case_assignment",
    )
