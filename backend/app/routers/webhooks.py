"""
Meta Webhook router — receives incoming social media queries from Meta
(Instagram/Facebook) and auto-routes them to the assigned department user
as a new Task.
"""
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.config import settings
from app.models.brands import BrandAssignment, SocialAccount
from app.models.user import Task, TaskStatus, TaskPriority

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
logger = logging.getLogger(__name__)


# ──────────────────────────── Meta Webhook ────────────────────────────

@router.get("/meta", summary="Meta webhook verification (GET challenge)")
async def verify_webhook(request: Request):
    """
    Meta sends a GET request with hub.challenge for webhook verification.
    Returns the hub.challenge value if the verify_token matches.
    """
    params = dict(request.query_params)
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    WEBHOOK_VERIFY_TOKEN = settings.WEBHOOK_VERIFY_TOKEN

    if mode == "subscribe" and token == WEBHOOK_VERIFY_TOKEN:
        logger.info("Meta webhook verified successfully.")
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=challenge or "")

    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/meta", summary="Receive Meta (Instagram/FB) webhook events")
async def receive_meta_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives incoming messages/comments from Meta platforms.
    Extracts recipient_id → looks up brand → finds assignment → creates Task.
    """
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON payload")

    logger.info("Meta webhook received: %s", str(payload)[:500])

    created_tasks = []

    # Walk through Meta's standard webhook payload structure
    entries = payload.get("entry", [])
    for entry in entries:
        messaging_events = entry.get("messaging", []) or entry.get("changes", [])
        for event in messaging_events:
            # Handle both direct message and page change format
            if "value" in event:
                event = event.get("value", {})

            recipient_id = None
            sender_info = {}
            message_text = ""

            # DM format
            if "recipient" in event:
                recipient_id = event["recipient"].get("id")
                sender_info = event.get("sender", {})
                msg = event.get("message", {})
                message_text = msg.get("text", "(media or attachment)")
            # Comments/mentions format
            elif "from" in event:
                recipient_id = entry.get("id") or event.get("recipient_id")
                sender_info = event.get("from", {})
                message_text = event.get("message", "") or event.get("comment", "")

            if not recipient_id:
                logger.warning("No recipient_id found in event, skipping.")
                continue

            # Look up social account by platform_account_id
            sa_result = await db.execute(
                select(SocialAccount).where(
                    SocialAccount.platform_account_id == str(recipient_id)
                )
            )
            social_account = sa_result.scalar_one_or_none()
            if not social_account:
                logger.warning("No social account found for recipient_id: %s", recipient_id)
                continue

            brand_id = social_account.brand_id
            platform = social_account.platform

            # Find brand assignment (pick first active assignment)
            ba_result = await db.execute(
                select(BrandAssignment).where(
                    BrandAssignment.brand_id == brand_id
                )
            )
            assignment = ba_result.scalars().first()
            if not assignment:
                logger.warning("No brand assignment found for brand_id: %s", brand_id)
                continue

            # Auto-create a Task
            sender_name = sender_info.get("name", "") or sender_info.get("id", "Unknown")
            task_title = f"[{platform.upper()}] Query from {sender_name}"
            task_description = (
                f"Incoming {platform} message from {sender_name}.\n\n"
                f"Message: {message_text}\n\n"
                f"Raw sender info: {sender_info}"
            )

            now = datetime.now(timezone.utc)
            task = Task(
                brand_id=brand_id,
                brand_name=None,
                title=task_title[:300],
                description=task_description,
                status=TaskStatus.YET_TO_START,
                priority=TaskPriority.HIGH,
                progress_percentage=0,
                is_overdue=False,
                department_id=assignment.department_id,
                assigned_to=assignment.user_id,
                assigned_by=assignment.user_id,  # system-created, attribute to assignee
                due_date=now + timedelta(hours=4),
                expected_delivery=now + timedelta(hours=4),
            )
            db.add(task)
            await db.flush()
            created_tasks.append(task.id)
            logger.info("Auto-created task %d for brand_id=%d", task.id, brand_id)
    await db.commit()

    if created_tasks:
        from app.core.websocket_manager import manager
        try:
            await manager.broadcast({
                "type": "TASK_CREATED",
                "message": "New Instagram / webhook query task created.",
                "task_ids": created_tasks
            })
        except Exception as ws_err:
            logger.error("Failed to broadcast webhook task creation notification: %s", ws_err)

    return {"status": "ok", "tasks_created": len(created_tasks), "task_ids": created_tasks}
