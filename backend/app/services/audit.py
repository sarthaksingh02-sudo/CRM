"""Audit log helper – called from routers to record every significant state change."""
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import TaskAuditLog


async def write_audit(
    db: AsyncSession,
    task_id: int,
    user_id: int,
    action_type: str,
    old_value: str | None = None,
    new_value: str | None = None,
) -> None:
    log = TaskAuditLog(
        task_id=task_id,
        user_id=user_id,
        action_type=action_type,
        old_value=old_value,
        new_value=new_value,
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    # Caller is responsible for commit (session is managed in get_db)
