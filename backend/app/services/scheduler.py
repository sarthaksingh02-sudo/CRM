"""
Background scheduler: runs at midnight to mark overdue tasks and
auto-shift expected_delivery to the next calendar day.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, and_

from app.core.database import AsyncSessionLocal
from app.models.user import Task, TaskStatus
from app.services.audit import write_audit

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


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    # Run daily at midnight UTC
    scheduler.add_job(process_overdue_tasks, "cron", hour=0, minute=0, id="overdue_check")
    scheduler.start()
    logger.info("Background scheduler started.")
    return scheduler
