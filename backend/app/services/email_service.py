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
