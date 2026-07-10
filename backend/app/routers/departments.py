from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import require_tier1
from app.models.user import Department, User
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
