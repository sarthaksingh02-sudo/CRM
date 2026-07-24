"""
Async email service for VoxoMate CRM automated notifications.
Sender: voxomate.imp@gmail.com (configured via EMAIL_PASSWORD env variable)
"""
import asyncio
import logging
import smtplib
import json
import urllib.request
import urllib.parse
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_smtp_email(to_email: str, subject: str, html_body: str) -> None:
    """Synchronous SMTP send — runs in a background thread via asyncio.to_thread."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
        server.sendmail(settings.EMAIL_FROM, to_email, msg.as_string())
    logger.info("SMTP Email sent to %s — Subject: %s", to_email, subject)


def _send_resend_email(to_email: str, subject: str, html_body: str) -> None:
    """Synchronous Resend API send — runs in a background thread via asyncio.to_thread."""
    import urllib.error
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    # Resend requires domain authorization. If using generic Resend sandbox keys, 
    # the sender must be onboarding@resend.dev.
    from_email = settings.EMAIL_FROM
    if "re_" in settings.RESEND_API_KEY and ("gmail.com" in from_email.lower() or "voxomate.com" in from_email.lower()):
        from_email = "onboarding@resend.dev"
        
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_body
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as response:
            resp_data = json.loads(response.read().decode("utf-8"))
            logger.info("Resend Email API sent to %s (ID: %s) — Subject: %s", to_email, resp_data.get("id"), subject)
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8")
        logger.error("Resend API HTTP Error %d: %s. Response body: %s", err.code, err.reason, err_body)
        raise Exception(f"Resend HTTP {err.code}: {err_body}") from err


async def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """
    Sends an HTML email asynchronously.
    Returns True on success, False if emails are disabled or sending fails.
    """
    if not settings.EMAILS_ENABLED:
        logger.debug("Emails disabled — skipping send to %s", to_email)
        return False

    try:
        if settings.RESEND_API_KEY:
            await asyncio.to_thread(_send_resend_email, to_email, subject, html_body)
        else:
            if not settings.EMAIL_PASSWORD:
                logger.debug("SMTP EMAIL_PASSWORD configuration missing — skipping send to %s", to_email)
                return False
            await asyncio.to_thread(_send_smtp_email, to_email, subject, html_body)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)
        return False


async def send_task_deadline_alert(
    to_email: str,
    assignee_name: str,
    task_title: str,
    brand_name: str,
    minutes_remaining: int,
) -> bool:
    """Sends a high-priority task deadline warning email."""
    subject = f"🚨 Deadline Alert: '{task_title}' is due in {minutes_remaining} minutes"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #7c6dfa; font-size: 24px; margin: 0;">VoxoMate CRM</h1>
            <p style="color: #a0a0b0; margin: 4px 0 0 0;">Automated Alert System</p>
        </div>

        <div style="background: #ff4757; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
            <h2 style="color: #fff; margin: 0; font-size: 20px;">⏰ Deadline Warning</h2>
            <p style="color: #ffe0e0; margin: 8px 0 0 0;">High Priority Task Expiring Soon</p>
        </div>

        <p style="color: #c0c0d0; line-height: 1.6;">Hi <strong style="color: #e0e0f0;">{assignee_name}</strong>,</p>

        <p style="color: #c0c0d0; line-height: 1.6;">
            This is an automated reminder that a <strong style="color: #ff6b6b;">HIGH priority</strong> task assigned to you is
            due in <strong style="color: #ff6b6b;">{minutes_remaining} minutes</strong>.
        </p>

        <div style="background: #2a2a40; border-left: 4px solid #7c6dfa; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong style="color: #7c6dfa;">Task:</strong> <span style="color: #e0e0f0;">{task_title}</span></p>
            <p style="margin: 0 0 8px 0;"><strong style="color: #7c6dfa;">Brand:</strong> <span style="color: #e0e0f0;">{brand_name}</span></p>
            <p style="margin: 0;"><strong style="color: #7c6dfa;">Priority:</strong> <span style="color: #ff6b6b;">HIGH</span></p>
        </div>

        <p style="color: #a0a0b0; line-height: 1.6;">
            Please log in to VoxoMate CRM immediately to update the task status or submit it for review.
        </p>

        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #3a3a50; text-align: center;">
            <p style="color: #606070; font-size: 12px; margin: 0;">
                This is an automated notification from VoxoMate CRM.<br>
                Do not reply to this email.
            </p>
        </div>
    </div>
    """
    return await send_email(to_email, subject, html_body)


async def send_task_assigned_alert(
    to_email: str,
    assignee_name: str,
    task_title: str,
    brand_name: str,
    assigned_by_name: str,
    due_date: str,
) -> bool:
    """Sends a new task assignment notification email."""
    subject = f"📋 New Task Assigned: '{task_title}'"
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; padding: 32px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #7c6dfa; font-size: 24px; margin: 0;">VoxoMate CRM</h1>
            <p style="color: #a0a0b0; margin: 4px 0 0 0;">Task Assignment Notification</p>
        </div>

        <div style="background: #7c6dfa; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
            <h2 style="color: #fff; margin: 0; font-size: 20px;">📋 New Task Assigned</h2>
        </div>

        <p style="color: #c0c0d0; line-height: 1.6;">Hi <strong style="color: #e0e0f0;">{assignee_name}</strong>,</p>

        <p style="color: #c0c0d0; line-height: 1.6;">
            <strong style="color: #7c6dfa;">{assigned_by_name}</strong> has assigned a new task to you.
        </p>

        <div style="background: #2a2a40; border-left: 4px solid #7c6dfa; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong style="color: #7c6dfa;">Task:</strong> <span style="color: #e0e0f0;">{task_title}</span></p>
            <p style="margin: 0 0 8px 0;"><strong style="color: #7c6dfa;">Brand:</strong> <span style="color: #e0e0f0;">{brand_name}</span></p>
            <p style="margin: 0;"><strong style="color: #7c6dfa;">Due Date:</strong> <span style="color: #e0e0f0;">{due_date}</span></p>
        </div>

        <p style="color: #a0a0b0; line-height: 1.6;">
            Log in to VoxoMate CRM to view your task details and get started.
        </p>

        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #3a3a50; text-align: center;">
            <p style="color: #606070; font-size: 12px; margin: 0;">
                This is an automated notification from VoxoMate CRM.<br>
                Do not reply to this email.
            </p>
        </div>
    </div>
    """
    return await send_email(to_email, subject, html_body)
