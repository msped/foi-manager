from django.conf import settings
from django.core.mail import EmailMessage

from apps.cases.email_utils import substitute
from apps.cases.models import EmailTemplate

from .models import RequesterVerificationCode

#: Used when no VERIFICATION_CODE template has been configured.
#:
#: Every other template-backed email in this system hard-fails when its template
#: is missing, and for staff-triggered actions that is right: a person is at a
#: screen, sees the error, and fixes the configuration. This email is triggered
#: by a member of the public who has no such recourse — what they would see is a
#: code that never arrives, on a page that cannot tell them why, with no way to
#: report it. So this one feature degrades to a plain, correct email instead.
FALLBACK_SUBJECT = "Your verification code"

#: Styling is inline and the font stack is Helvetica/Arial, matching GOV.UK
#: Notify. Email clients strip <style> blocks and cannot load webfonts, so an
#: element with no font-family falls back to the client's default — usually
#: Times — which is what the digits below would otherwise render in.
FALLBACK_BODY = """\
<div style="font-family: Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #0b0c0c;">
<p>Use this code to check the progress of your Freedom of Information requests:</p>
<p style="font-family: Helvetica, Arial, sans-serif; font-size: 36px; font-weight: bold; letter-spacing: 6px; margin: 24px 0;">{{code}}</p>
<p>The code expires in {{expires_minutes}} minutes.</p>
<p>If you did not ask for this code, you can ignore this email.</p>
<p>{{organisation_name}}<br>{{foi_contact_email}}</p>
</div>
"""


def build_context(code: str) -> dict:
    """Template variables for the verification email.

    Built at issue time and passed through the queue, so the worker renders the
    same values the web process decided on.
    """
    return {
        "code": code,
        "expires_minutes": str(RequesterVerificationCode.TTL_MINUTES),
        "organisation_name": getattr(settings, "ORGANISATION_NAME", "Organisation"),
        "foi_contact_email": getattr(
            settings, "FOI_CONTACT_EMAIL", settings.DEFAULT_FROM_EMAIL
        ),
    }


def send_verification_code(email: str, context: dict):
    """Email a one-time code to someone checking their own requests.

    Deliberately carries no case detail — no reference, no request text, not
    even a name. Anyone can trigger this email by typing an address into the
    portal, so it has to be safe to deliver to a stranger who mistyped, and to
    whoever else reads a shared mailbox. There is nothing in it to leak.

    No CaseAuditEvent is written: at this point no case has been identified, and
    the address may belong to nobody. A successful verification is recorded
    against the address in RequesterVerification instead.
    """
    template = EmailTemplate.objects.filter(
        purpose=EmailTemplate.Purpose.VERIFICATION_CODE
    ).first()

    if template:
        subject = template.render_subject(context) or FALLBACK_SUBJECT
        body = template.render(context)
    else:
        subject = FALLBACK_SUBJECT
        body = substitute(FALLBACK_BODY, context)

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[email],
    )
    msg.content_subtype = "html"
    msg.send(fail_silently=False)
