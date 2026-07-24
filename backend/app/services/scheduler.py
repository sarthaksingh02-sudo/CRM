"""
Background scheduler: runs at midnight to mark overdue tasks and
auto-shift expected_delivery to the next calendar day.
Also runs every 5 minutes to check HIGH priority tasks due within 30 minutes
and sends deadline alert emails to assigned users.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.user import Task, TaskStatus, TaskPriority, User
from app.services.audit import write_audit
from app.services.email_service import send_task_deadline_alert

logger = logging.getLogger(__name__)


async def process_overdue_tasks() -> None:
    """Evaluate all incomplete tasks; mark overdue and roll expected_delivery forward."""
    logger.info("Running overdue task check…")
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Task).where(
                    and_(
                        Task.status.not_in([TaskStatus.COMPLETED]),
                        Task.due_date < today_start,
                    )
                )
            )
            tasks = result.scalars().all()

            for task in tasks:
                old_expected = task.expected_delivery.isoformat()
                # Shift expected_delivery forward by one day (rolling)
                task.expected_delivery = task.expected_delivery + timedelta(days=1)
                if not task.is_overdue:
                    task.is_overdue = True

                await write_audit(
                    db=db,
                    task_id=task.id,
                    user_id=task.assigned_by,  # System action attributed to assigner
                    action_type="AUTO_OVERDUE_ROLLOVER",
                    old_value=old_expected,
                    new_value=task.expected_delivery.isoformat(),
                )

            await db.commit()
            logger.info("Processed %d overdue tasks.", len(tasks))
        except Exception as exc:
            await db.rollback()
            logger.exception("Error during overdue task processing: %s", exc)


async def check_high_priority_deadline_alerts() -> None:
    """
    Every 5 minutes: find HIGH priority tasks whose expected_delivery is between
    25 and 35 minutes from now (30-minute window). Send email alert to assignee.
    """
    logger.info("Running high-priority deadline alert check…")
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(minutes=25)
    window_end = now + timedelta(minutes=35)

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(Task)
                .options(selectinload(Task.assignee))
                .where(
                    and_(
                        Task.status.not_in([TaskStatus.COMPLETED, TaskStatus.IN_REVIEW]),
                        Task.priority == TaskPriority.HIGH,
                        Task.expected_delivery >= window_start,
                        Task.expected_delivery <= window_end,
                    )
                )
            )
            tasks = result.scalars().all()

            for task in tasks:
                if task.assignee and task.assignee.email:
                    assignee_name = f"{task.assignee.first_name} {task.assignee.last_name}"
                    
                    # Normalize subtraction to handle both naive and aware datetimes dynamically
                    delivery_dt = task.expected_delivery
                    now_dt = now
                    if delivery_dt.tzinfo is None or now_dt.tzinfo is None:
                        if delivery_dt.tzinfo is not None:
                            delivery_dt = delivery_dt.astimezone(timezone.utc).replace(tzinfo=None)
                        if now_dt.tzinfo is not None:
                            now_dt = now_dt.astimezone(timezone.utc).replace(tzinfo=None)
                            
                    minutes_left = int((delivery_dt - now_dt).total_seconds() / 60)
                    brand_label = getattr(task, "brand_name", None) or "N/A"
                    # If brand relation loaded, use brand name
                    if hasattr(task, "brand") and task.brand:
                        brand_label = task.brand.name

                    await send_task_deadline_alert(
                        to_email=task.assignee.email,
                        assignee_name=assignee_name,
                        task_title=task.title,
                        brand_name=brand_label,
                        minutes_remaining=minutes_left,
                    )
                    logger.info(
                        "Deadline alert sent for task %d to %s", task.id, task.assignee.email
                    )

            logger.info("Deadline alert check: %d tasks found in 30-min window.", len(tasks))
        except Exception as exc:
            logger.exception("Error during deadline alert check: %s", exc)


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    # Run daily at midnight UTC — marks overdue tasks and rolls delivery date
    scheduler.add_job(process_overdue_tasks, "cron", hour=0, minute=0, id="overdue_check")
    # Run every 5 minutes — sends deadline warning emails to HIGH priority task assignees
    scheduler.add_job(
        check_high_priority_deadline_alerts,
        "interval",
        minutes=5,
        id="deadline_alert_check",
    )
    scheduler.start()
    logger.info("Background scheduler started (overdue check + deadline alerts).")
    return scheduler
