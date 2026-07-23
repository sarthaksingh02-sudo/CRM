"""
Notifications router — delivers in-app alerts for the logged-in user.
Returns overdue tasks assigned to the user and recently-assigned tasks (last 24h).
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import Task, TaskStatus, User, task_assignees
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationItem(BaseModel):
    id: int
    type: str          # "overdue" | "assigned"
    task_id: int
    task_title: str
    brand_label: str
    message: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[NotificationItem], summary="Get in-app notifications")
async def get_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications: list[NotificationItem] = []
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)

    # Query tasks for this user (assigned_to or co-assignee, not completed)
    result = await db.execute(
        select(Task)
        .join(task_assignees, (Task.id == task_assignees.c.task_id), isouter=True)
        .where(
            (Task.assigned_to == current_user.id) |
            (task_assignees.c.user_id == current_user.id)
        )
        .where(Task.status != TaskStatus.COMPLETED)
    )
    tasks = result.scalars().unique().all()

    notif_id = 1
    for task in tasks:
        brand_label = getattr(task, "brand_name", None) or "N/A"

        # Overdue tasks
        if task.is_overdue:
            notifications.append(NotificationItem(
                id=notif_id,
                type="overdue",
                task_id=task.id,
                task_title=task.title,
                brand_label=brand_label,
                message=f"Task '{task.title}' is overdue",
                created_at=task.due_date,
            ))
            notif_id += 1

    # Recently assigned tasks (last 24h) - check tasks where I'm assignee with YET_TO_START
    recent_result = await db.execute(
        select(Task)
        .where(
            Task.assigned_to == current_user.id,
            Task.status == TaskStatus.YET_TO_START,
        )
    )
    recent_tasks = recent_result.scalars().all()

    for task in recent_tasks:
        brand_label = getattr(task, "brand_name", None) or "N/A"
        notifications.append(NotificationItem(
            id=notif_id,
            type="assigned",
            task_id=task.id,
            task_title=task.title,
            brand_label=brand_label,
            message=f"New task assigned: '{task.title}'",
            created_at=task.due_date,
        ))
        notif_id += 1

    # Limit to 20 most important (overdue first)
    notifications.sort(key=lambda n: (0 if n.type == "overdue" else 1))
    return notifications[:20]
