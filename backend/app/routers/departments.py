from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from collections import defaultdict
import datetime

from app.core.database import get_db
from app.core.security import require_tier1, get_current_user
from app.models.user import Department, User, Task
from app.schemas.schemas import DepartmentCreate, DepartmentRead

router = APIRouter(prefix="/departments", tags=["Departments"])


@router.post("/", response_model=DepartmentRead, status_code=201,
             summary="Create department (Tier 1 only)")
async def create_department(
    payload: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    result = await db.execute(select(Department).where(Department.name == payload.name))
    if result.scalar_one_or_none():
        raise HTTPException(409, "Department name already exists")
    dept = Department(name=payload.name)
    db.add(dept)
    await db.flush()
    await db.refresh(dept)
    return dept


@router.get("/", response_model=list[DepartmentRead], summary="List all departments")
async def list_departments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Department))
    return result.scalars().all()


@router.get("/{dept_id}/monthly-report", summary="Get monthly report metrics for a department")
async def get_department_monthly_report(
    dept_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Security: tier 2 is scoped to their department; tier 3 does not have access.
    if current_user.role_tier == 2 and current_user.department_id != dept_id:
        raise HTTPException(403, "Not authorized to access other department reports")
    if current_user.role_tier == 3:
        raise HTTPException(403, "Staff cannot access departmental reports")

    # Fetch tasks
    query = select(Task).where(Task.department_id == dept_id)
    result = await db.execute(query)
    tasks = result.scalars().all()

    # Aggregate by month
    monthly_data = defaultdict(lambda: {"volume": 0, "completed": 0, "progress_sum": 0.0, "overdue": 0})
    
    for t in tasks:
        date_val = t.due_date or t.created_at
        if not date_val:
            continue
        month_str = date_val.strftime("%Y-%m")
        stats = monthly_data[month_str]
        stats["volume"] += 1
        if t.status == "completed":
            stats["completed"] += 1
        stats["progress_sum"] += t.progress_percentage
        if t.is_overdue:
            stats["overdue"] += 1

    # Format into a sorted list of past 6 months
    today = datetime.date.today()
    months = []
    for i in range(5, -1, -1):
        # Subtract months
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        months.append(f"{year:04d}-{month:02d}")

    report = []
    for m in months:
        stats = monthly_data.get(m, {"volume": 0, "completed": 0, "progress_sum": 0.0, "overdue": 0})
        avg_progress = round(stats["progress_sum"] / stats["volume"], 1) if stats["volume"] > 0 else 0.0
        report.append({
            "month": m,
            "volume": stats["volume"],
            "completed": stats["completed"],
            "avg_progress": avg_progress,
            "overdue": stats["overdue"]
        })

    return report
