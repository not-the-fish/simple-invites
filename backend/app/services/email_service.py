"""Email service for sending RSVP confirmations.

In development mode, emails are logged to console instead of sent.
In production, emails are sent via Gmail SMTP using app password.
"""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_rsvp_confirmation(
    to_email: str,
    guest_name: str,
    event_title: str,
    response: str,
    num_attendees: int | None,
    edit_url: str,
) -> bool:
    """Send RSVP confirmation email with edit link.

    In development mode, logs the email instead of sending.
    In production, sends via Gmail SMTP.

    Args:
        to_email: Recipient email address
        guest_name: Name of the guest
        event_title: Title of the event
        response: RSVP response (yes/no/maybe)
        num_attendees: Number of attendees (for yes/maybe responses)
        edit_url: URL for editing the RSVP (includes edit token in fragment)

    Returns:
        True if email was sent (or logged in dev), False if skipped or failed
    """
    subject = f"Your RSVP for {event_title}"

    # Build email body
    attendees_line = f"\nNumber of guests: {num_attendees}" if num_attendees else ""
    text = f"""Hi {guest_name},

Thanks for your RSVP to {event_title}!

Your response: {response.upper()}{attendees_line}

To change your RSVP, visit:
{edit_url}

This link is unique to you - don't share it with others.

See you there!
"""

    # Development mode: log instead of sending
    if settings.is_development:
        logger.info(f"[DEV EMAIL] To: {to_email}")
        logger.info(f"[DEV EMAIL] Subject: {subject}")
        logger.info(f"[DEV EMAIL] Edit URL: {edit_url}")
        logger.info(f"[DEV EMAIL] Body:\n{text}")
        return True

    # Production mode: send via Gmail SMTP
    if not settings.SMTP_EMAIL or not settings.SMTP_APP_PASSWORD:
        logger.warning(f"SMTP not configured, skipping email to {to_email}")
        return False

    # Import aiosmtplib only when needed (not installed in dev by default)
    try:
        import aiosmtplib
    except ImportError:
        logger.error("aiosmtplib not installed, cannot send email")
        return False

    message = MIMEMultipart("alternative")
    message["From"] = f"{settings.email_from_name} <{settings.SMTP_EMAIL}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.attach(MIMEText(text, "plain"))

    try:
        await aiosmtplib.send(
            message,
            hostname="smtp.gmail.com",
            port=587,
            username=settings.SMTP_EMAIL,
            password=settings.SMTP_APP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Sent RSVP confirmation email to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        # Don't raise - email failure shouldn't break RSVP submission
        return False


def format_answer(answer: object) -> str:
    """Render a survey answer (stored as flexible JSON) into readable text.

    Answer shapes vary by question type (see backend/docs/JSON_COLUMNS.md):
    string, bool, list, {"value", "other_text"}, {"values", "other_text"},
    or a row->column mapping for matrix questions. Unknown shapes fall back
    to str() rather than raising.
    """
    if isinstance(answer, bool):
        return "Yes" if answer else "No"
    if isinstance(answer, str):
        return answer
    if isinstance(answer, list):
        return ", ".join(str(item) for item in answer)
    if isinstance(answer, dict):
        # multiple_choice with "other" selected
        if "value" in answer:
            value = answer.get("value")
            other = answer.get("other_text")
            if value == "other" and other:
                return f"Other: {other}"
            return str(value)
        # checkbox, possibly with "other" text
        if "values" in answer:
            values = answer.get("values") or []
            parts = [str(item) for item in values]
            other = answer.get("other_text")
            if other:
                parts.append(f"Other: {other}")
            return ", ".join(parts)
        # matrix_single: {row: column, ...}
        return "; ".join(f"{key}: {value}" for key, value in answer.items())
    return str(answer)


async def send_host_rsvp_notification(
    to_email: str,
    event_title: str,
    guest_name: str,
    response: str,
    num_attendees: int | None,
    guest_email: str | None,
    guest_phone: str | None,
    comment: str | None,
    survey_answers: list[tuple[str, str]],
    is_update: bool,
) -> bool:
    """Notify the event host that a guest has submitted or updated an RSVP.

    In development mode, logs the email instead of sending.
    In production, sends via Gmail SMTP.

    Args:
        to_email: Host (event creator) email address
        event_title: Title of the event
        guest_name: Name/identity the guest provided
        response: RSVP response (yes/no/maybe)
        num_attendees: Number of attendees (for yes/maybe responses)
        guest_email: Guest's contact email, if provided
        guest_phone: Guest's contact phone, if provided
        comment: Guest's free-text comment, if provided
        survey_answers: List of (question_text, formatted_answer) pairs
        is_update: False for a new RSVP, True when a guest edited an existing one

    Returns:
        True if email was sent (or logged in dev), False if skipped or failed
    """
    verb = "Updated" if is_update else "New"
    subject = f"{verb} RSVP for {event_title}: {guest_name} ({response.upper()})"

    # Build email body
    lines = [
        f"{guest_name} {'updated their' if is_update else 'submitted an'} RSVP "
        f"for {event_title}.",
        "",
        f"Response: {response.upper()}",
    ]
    if num_attendees:
        lines.append(f"Number of guests: {num_attendees}")
    if guest_email:
        lines.append(f"Email: {guest_email}")
    if guest_phone:
        lines.append(f"Phone: {guest_phone}")
    if comment:
        lines.append(f"Comment: {comment}")
    if survey_answers:
        lines.append("")
        lines.append("Survey answers:")
        for question_text, answer_text in survey_answers:
            lines.append(f"- {question_text}: {answer_text}")
    text = "\n".join(lines) + "\n"

    # Development mode: log instead of sending
    if settings.is_development:
        logger.info(f"[DEV EMAIL] To: {to_email}")
        logger.info(f"[DEV EMAIL] Subject: {subject}")
        logger.info(f"[DEV EMAIL] Body:\n{text}")
        return True

    # Production mode: send via Gmail SMTP
    if not settings.SMTP_EMAIL or not settings.SMTP_APP_PASSWORD:
        logger.warning(f"SMTP not configured, skipping host notification to {to_email}")
        return False

    # Import aiosmtplib only when needed (not installed in dev by default)
    try:
        import aiosmtplib
    except ImportError:
        logger.error("aiosmtplib not installed, cannot send email")
        return False

    message = MIMEMultipart("alternative")
    message["From"] = f"{settings.email_from_name} <{settings.SMTP_EMAIL}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.attach(MIMEText(text, "plain"))

    try:
        await aiosmtplib.send(
            message,
            hostname="smtp.gmail.com",
            port=587,
            username=settings.SMTP_EMAIL,
            password=settings.SMTP_APP_PASSWORD,
            start_tls=True,
        )
        logger.info(f"Sent host RSVP notification to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send host notification to {to_email}: {e}")
        # Don't raise - email failure shouldn't break RSVP submission
        return False
