import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, UploadFile, File, status, Response
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_tier1, require_tier2, require_tier3
from app.models.user import Task, TaskStatus, TaskComment, TaskAttachment, User, Department, task_assignees
from app.schemas.schemas import (
    AuditLogRead,
    AttachmentRead,
    CommentCreate,
    CommentRead,
    DepartmentMetrics,
    PersonalMetrics,
    TaskCreate,
    TaskProgressUpdate,
    TaskRead,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.services.audit import write_audit

router = APIRouter(prefix="/tasks", tags=["Tasks"])


# ──────────────────────────── Helpers ────────────────────────────

def _assert_can_access_task(current_user: User, task: Task) -> None:
    """Raises 403 if user cannot see the task."""
    if current_user.role_tier == 1:
        return
    if current_user.role_tier == 2 and task.department_id == current_user.department_id:
        return
    if current_user.role_tier == 3 and task.assigned_to == current_user.id:
        return
    raise HTTPException(status_code=403, detail="Access to this task is denied")


def _assert_can_write_task(current_user: User, task: Task) -> None:
    """Raises 403 for write operations based on tier."""
    if current_user.role_tier == 1:
        return
    if current_user.role_tier == 2 and task.department_id == current_user.department_id:
        return
    raise HTTPException(status_code=403, detail="Write access to this task is denied")


async def _load_task_with_relations(db: AsyncSession, task_id: int) -> Task:
    """Helper to query a task with all nested relationships eagerly loaded."""
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.department),
            selectinload(Task.assignee).selectinload(User.department),
            selectinload(Task.assigner).selectinload(User.department),
            selectinload(Task.co_assignees).selectinload(User.department),
        )
        .where(Task.id == task_id)
    )
    return result.scalar_one()


# ──────────────────────────── CRUD ────────────────────────────

@router.post("/", response_model=TaskRead, status_code=201, summary="Create task (Tier 1 & 2)")
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_tier2),
):
    # Tier 2 can only create tasks within their own department
    if current_user.role_tier == 2 and payload.department_id != current_user.department_id:
        raise HTTPException(403, "You can only create tasks in your own department")

    task = Task(
        brand_name=payload.brand_name,
        brand_id=payload.brand_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        department_id=payload.department_id,
        assigned_to=payload.assigned_to,
        assigned_by=current_user.id,
        due_date=payload.due_date,
        expected_delivery=payload.expected_delivery,
        status=TaskStatus.YET_TO_START,
        progress_percentage=0,
        is_overdue=False,
    )
    if payload.co_assignee_ids:
        co_users_res = await db.execute(select(User).where(User.id.in_(payload.co_assignee_ids)))
        task.co_assignees = co_users_res.scalars().all()
    db.add(task)
    await db.flush()
    await write_audit(db, task.id, current_user.id, "TASK_CREATED", None, task.title)
    await db.commit()
    
    full_task = await _load_task_with_relations(db, task.id)
    from app.core.websocket_manager import manager
    try:
        await manager.broadcast({
            "type": "TASK_CREATED",
            "message": f"New task created: {task.title}",
            "task_id": task.id
        })
    except Exception:
        pass
    return full_task


@router.get("/", response_model=list[TaskRead], summary="List tasks (scoped by RBAC)")
async def list_tasks(
    status_filter: Optional[str] = Query(None),
    priority_filter: Optional[str] = Query(None),
    overdue_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Task).options(
        selectinload(Task.department),
        selectinload(Task.assignee).selectinload(User.department),
        selectinload(Task.assigner).selectinload(User.department),
        selectinload(Task.co_assignees),
    )

    # RBAC scoping
    if current_user.role_tier == 2:
        q = q.where(Task.department_id == current_user.department_id)
    elif current_user.role_tier == 3:
        q = q.join(
            task_assignees,
            (Task.id == task_assignees.c.task_id),
            isouter=True
        ).where(
            (Task.assigned_to == current_user.id) |
            (task_assignees.c.user_id == current_user.id)
        )

    if status_filter:
        q = q.where(Task.status == status_filter)
    if priority_filter:
        q = q.where(Task.priority == priority_filter)
    if overdue_only:
        q = q.where(Task.is_overdue == True)

    result = await db.execute(q)
    return result.scalars().unique().all()


@router.get("/{task_id}", response_model=TaskRead, summary="Get task by ID")
async def get_task(
    task_id: int = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = await _load_task_with_relations(db, task_id)
    except Exception:
        raise HTTPException(404, "Task not found")
    _assert_can_access_task(current_user, task)
    return task


@router.patch("/{task_id}", response_model=TaskRead, summary="Update task metadata (Tier 1 & 2)")
async def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_tier2),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    _assert_can_write_task(current_user, task)

    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "expected_delivery":
            old = str(task.expected_delivery)
            setattr(task, field, value)
            await write_audit(db, task.id, current_user.id, "DATE_SHIFT", old, str(value))
        elif field == "assigned_to":
            old = str(task.assigned_to)
            setattr(task, field, value)
            await write_audit(db, task.id, current_user.id, "ASSIGNEE_REASSIGNED", old, str(value))
        elif field == "co_assignee_ids":
            co_users_res = await db.execute(select(User).where(User.id.in_(value)))
            task.co_assignees = co_users_res.scalars().all()
            await write_audit(db, task.id, current_user.id, "CO_ASSIGNEES_CHANGED", "N/A", f"Co-assignees updated; count: {len(task.co_assignees)}")
        else:
            setattr(task, field, value)

    await db.flush()
    await db.commit()
    full_task = await _load_task_with_relations(db, task.id)
    from app.core.websocket_manager import manager
    try:
        await manager.broadcast({
            "type": "TASK_UPDATED",
            "message": f"Task updated: {task.title}",
            "task_id": task.id
        })
    except Exception:
        pass
    return full_task


@router.delete("/{task_id}", status_code=204, summary="Delete task (Tier 1 & 2)")
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_tier2),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    _assert_can_write_task(current_user, task)
    await db.delete(task)
    await db.flush()
    await db.commit()
    from app.core.websocket_manager import manager
    try:
        await manager.broadcast({
            "type": "TASK_UPDATED",
            "message": "Task deleted",
            "task_id": task_id
        })
    except Exception:
        pass


# ──────────────────────────── State Machine Endpoints ────────────────────────────

@router.patch("/{task_id}/start", response_model=TaskRead, summary="Start task (assignee or co-assignee only)")
async def start_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_tier3),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    is_assigned = (task.assigned_to == current_user.id) or (current_user.id in [c.id for c in task.co_assignees])
    if current_user.role_tier == 3 and not is_assigned:
        raise HTTPException(403, "You can only start tasks assigned to you")

    if task.status not in (TaskStatus.YET_TO_START, TaskStatus.REWORK):
        raise HTTPException(409, f"Cannot start task in status '{task.status}'")

    old_status = task.status
    task.status = TaskStatus.IN_PROGRESS
    task.progress_percentage = max(task.progress_percentage, 1)
    await write_audit(db, task.id, current_user.id, "STATUS_CHANGE", old_status, TaskStatus.IN_PROGRESS)

    await db.flush()
    await db.commit()
    full_task = await _load_task_with_relations(db, task.id)
    from app.core.websocket_manager import manager
    try:
        await manager.broadcast({
            "type": "TASK_UPDATED",
            "message": f"Task started: {task.title}",
            "task_id": task.id
        })
    except Exception:
        pass
    return full_task


@router.patch("/{task_id}/progress", response_model=TaskRead,
              summary="Update progress % (assignee, Tier 3) — PATCH slide endpoint")
async def update_progress(
    task_id: int,
    payload: TaskProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    is_assigned = (task.assigned_to == current_user.id) or (current_user.id in [c.id for c in task.co_assignees])
    if current_user.role_tier == 3 and not is_assigned:
        raise HTTPException(403, "Progress can only be updated by a task assignee")

    if task.status != TaskStatus.IN_PROGRESS:
        raise HTTPException(409, f"Cannot update progress when task status is '{task.status}'. Start it first if it is yet_to_start or in rework.")

    old_progress = task.progress_percentage
    new_progress = payload.progress_percentage

    task.progress_percentage = new_progress

    # Audit any jump greater than 25%
    jump = abs(new_progress - old_progress)
    if jump > 25:
        await write_audit(
            db, task.id, current_user.id, "LARGE_PROGRESS_JUMP",
            str(old_progress), str(new_progress)
        )
    else:
        await write_audit(
            db, task.id, current_user.id, "PROGRESS_UPDATE",
            str(old_progress), str(new_progress)
        )

    await db.flush()
    await db.commit()
    full_task = await _load_task_with_relations(db, task.id)
    from app.core.websocket_manager import manager
    try:
        await manager.broadcast({
            "type": "TASK_UPDATED",
            "message": f"Task progress updated: {task.title}",
            "task_id": task.id
        })
    except Exception:
        pass
    return full_task


@router.patch("/{task_id}/submit-review", response_model=TaskRead,
              summary="Submit task for review — moves to in_review (assignee only)")
async def submit_for_review(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    is_assigned = (task.assigned_to == current_user.id) or (current_user.id in [c.id for c in task.co_assignees])
    if current_user.role_tier == 3 and not is_assigned:
        raise HTTPException(403, "Only the assignee or a co-assignee can submit a task for review")

    if task.status != TaskStatus.IN_PROGRESS:
        raise HTTPException(409, f"Task must be in_progress to submit for review; current: '{task.status}'")

    old_status = task.status
    task.status = TaskStatus.IN_REVIEW
    task.progress_percentage = 100
    await write_audit(db, task.id, current_user.id, "STATUS_CHANGE", old_status, TaskStatus.IN_REVIEW)

    await db.flush()
    await db.commit()
    full_task = await _load_task_with_relations(db, task.id)
    from app.core.websocket_manager import manager
    try:
        await manager.broadcast({
            "type": "TASK_UPDATED",
            "message": f"Task submitted for review: {task.title}",
            "task_id": task.id
        })
    except Exception:
        pass
    return full_task


@router.patch("/{task_id}/review-decision", response_model=TaskRead,
              summary="Dept Head reviews: complete or rework (Tier 1 & 2)")
async def review_decision(
    task_id: int,
    payload: TaskStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_tier2),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")

    _assert_can_write_task(current_user, task)

    if task.status != TaskStatus.IN_REVIEW:
        raise HTTPException(409, "Task must be in_review before a review decision")

    old_status = task.status

    if payload.status == "completed":
        task.status = TaskStatus.COMPLETED
        task.progress_percentage = 100
        await write_audit(db, task.id, current_user.id, "STATUS_CHANGE", old_status, TaskStatus.COMPLETED)

    elif payload.status == "rework":
        task.status = TaskStatus.REWORK
        task.progress_percentage = payload.rework_progress  # type: ignore[assignment]
        await write_audit(db, task.id, current_user.id, "STATUS_CHANGE", old_status, TaskStatus.REWORK)

        # Add mandatory rework comment
        comment = TaskComment(
            task_id=task.id,
            user_id=current_user.id,
            content=f"[REWORK] {payload.rework_comment}",
        )
        db.add(comment)

    await db.flush()
    await db.commit()
    full_task = await _load_task_with_relations(db, task.id)
    from app.core.websocket_manager import manager
    try:
        await manager.broadcast({
            "type": "TASK_UPDATED",
            "message": f"Task review decision: {task.title}",
            "task_id": task.id
        })
    except Exception:
        pass
    return full_task


# ──────────────────────────── Comments ────────────────────────────

@router.post("/{task_id}/comments", response_model=CommentRead, status_code=201,
             summary="Add comment to task")
async def add_comment(
    task_id: int,
    payload: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    _assert_can_access_task(current_user, task)

    comment = TaskComment(task_id=task_id, user_id=current_user.id, content=payload.content)
    db.add(comment)
    await db.flush()
    res = await db.execute(
        select(TaskComment)
        .options(selectinload(TaskComment.user).selectinload(User.department))
        .where(TaskComment.id == comment.id)
    )
    comment_data = res.scalar_one()
    await db.commit()
    from app.core.websocket_manager import manager
    try:
        await manager.broadcast({
            "type": "TASK_UPDATED",
            "message": f"New comment on task: {task.title}",
            "task_id": task_id
        })
    except Exception:
        pass
    return comment_data


@router.get("/{task_id}/comments", response_model=list[CommentRead], summary="Get comments")
async def get_comments(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    _assert_can_access_task(current_user, task)

    res = await db.execute(
        select(TaskComment)
        .options(selectinload(TaskComment.user).selectinload(User.department))
        .where(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.asc())
    )
    return res.scalars().all()


# ──────────────────────────── Attachments ────────────────────────────

@router.post("/{task_id}/attachments", response_model=AttachmentRead, status_code=201,
             summary="Add file attachment (URL-based)")
async def add_attachment(
    task_id: int,
    file_name: str,
    file_url: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task not found")
    _assert_can_access_task(current_user, task)

    attachment = TaskAttachment(
        task_id=task_id, uploader_id=current_user.id, file_name=file_name, file_url=file_url
    )
    db.add(attachment)
    await db.flush()
    await db.refresh(attachment)
    return attachment


# ──────────────────────────── Audit Logs ────────────────────────────

@router.get("/{task_id}/audit", response_model=list[AuditLogRead],
            summary="Get audit log for task (Tier 1 & 2)")
async def get_audit(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier2),
):
    from app.models.user import TaskAuditLog
    res = await db.execute(
        select(TaskAuditLog).where(TaskAuditLog.task_id == task_id).order_by(TaskAuditLog.created_at.asc())
    )
    return res.scalars().all()


# ──────────────────────────── Metrics ────────────────────────────

@router.get("/metrics/department", response_model=list[DepartmentMetrics],
            summary="Department-level task metrics (Tier 1 & 2)")
async def department_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_tier2),
):
    dept_q = select(Department)
    if current_user.role_tier == 2 and current_user.department_id:
        dept_q = dept_q.where(Department.id == current_user.department_id)
    depts_res = await db.execute(dept_q)
    depts = depts_res.scalars().all()

    metrics = []
    for dept in depts:
        tasks_res = await db.execute(select(Task).where(Task.department_id == dept.id))
        tasks = tasks_res.scalars().all()

        total = len(tasks)
        completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
        in_prog = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
        overdue = sum(1 for t in tasks if t.is_overdue)
        avg_prog = round(sum(t.progress_percentage for t in tasks) / total, 1) if total else 0.0

        metrics.append(DepartmentMetrics(
            department_id=dept.id,
            department_name=dept.name,
            total_tasks=total,
            completed=completed,
            in_progress=in_prog,
            overdue=overdue,
            avg_progress=avg_prog,
        ))
    return metrics


@router.get("/metrics/personal", response_model=PersonalMetrics,
            summary="Personal task metrics for the authenticated user")
async def personal_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    res = await db.execute(
        select(Task)
        .join(task_assignees, (Task.id == task_assignees.c.task_id), isouter=True)
        .where(
            (Task.assigned_to == current_user.id) |
            (task_assignees.c.user_id == current_user.id)
        )
    )
    tasks = res.scalars().unique().all()

    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
    in_prog = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
    in_review = sum(1 for t in tasks if t.status == TaskStatus.IN_REVIEW)
    overdue = sum(1 for t in tasks if t.is_overdue)
    avg_prog = round(sum(t.progress_percentage for t in tasks) / total, 1) if total else 0.0

    return PersonalMetrics(
        total_assigned=total,
        completed=completed,
        in_progress=in_prog,
        in_review=in_review,
        overdue=overdue,
        avg_progress=avg_prog,
    )


@router.get("/export/csv", summary="Export all visible tasks to CSV")
async def export_tasks_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Query tasks the current user is allowed to access
    query = select(Task).options(
        selectinload(Task.department),
        selectinload(Task.assignee),
        selectinload(Task.assigner),
        selectinload(Task.co_assignees),
    )
    if current_user.role_tier == 2:
        query = query.where(Task.department_id == current_user.department_id)
    elif current_user.role_tier == 3:
        query = query.join(
            task_assignees,
            (Task.id == task_assignees.c.task_id),
            isouter=True
        ).where(
            (Task.assigned_to == current_user.id) |
            (task_assignees.c.user_id == current_user.id)
        )
        
    result = await db.execute(query)
    tasks = result.scalars().unique().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Task ID", "Brand Name", "Title", "Description", "Status", 
        "Progress %", "Priority", "Department", "Assignee", "Assigner", 
        "Co-Assignees", "Due Date", "Expected Delivery Date", "Is Overdue"
    ])
    
    for t in tasks:
        co_emails = ", ".join([c.email for c in t.co_assignees])
        writer.writerow([
            t.id, t.brand_name, t.title, t.description or "", t.status.value if hasattr(t.status, 'value') else t.status,
            t.progress_percentage, t.priority.value if hasattr(t.priority, 'value') else t.priority,
            t.department.name if t.department else "",
            t.assignee.email if t.assignee else "",
            t.assigner.email if t.assigner else "",
            co_emails,
            t.due_date.isoformat() if t.due_date else "",
            t.expected_delivery.isoformat() if t.expected_delivery else "",
            t.is_overdue
        ])
        
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=tasks_export.csv"
    return response


@router.get("/audit/export/csv", summary="Export audit logs as CSV")
async def export_audit_logs_csv(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_tier2),
):
    from app.models.user import TaskAuditLog
    query = select(TaskAuditLog).options(
        selectinload(TaskAuditLog.task),
        selectinload(TaskAuditLog.user),
    ).order_by(TaskAuditLog.created_at.asc())
    
    if current_user.role_tier == 2:
        query = query.join(Task).where(Task.department_id == current_user.department_id)
        
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            query = query.where(TaskAuditLog.created_at >= start_dt)
        except ValueError:
            raise HTTPException(400, "Invalid start_date format. Use ISO format YYYY-MM-DD")
            
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
            query = query.where(TaskAuditLog.created_at <= end_dt)
        except ValueError:
            raise HTTPException(400, "Invalid end_date format. Use ISO format YYYY-MM-DD")

    result = await db.execute(query)
    logs = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Log ID", "Task ID", "Task Title", "User Email", "Action Type", 
        "Old Value", "New Value", "Timestamp"
    ])
    
    for l in logs:
        writer.writerow([
            l.id, l.task_id, l.task.title if l.task else "", l.user.email if l.user else "",
            l.action_type, l.old_value or "", l.new_value or "",
            l.created_at.isoformat() if l.created_at else ""
        ])
        
    response = Response(content=output.getvalue(), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=audit_logs_export.csv"
    return response
