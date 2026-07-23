"""
Brands router — CRUD for brands, social accounts, and brand assignments.
Restricted to Tier 1 (Executive Admin) only.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_tier1
from app.models.brands import Brand, BrandAssignment, BrandStatus, SocialAccount, SocialPlatform
from app.models.user import User, Task

router = APIRouter(prefix="/brands", tags=["Brands"])


# ──────────────────────────── Schemas ────────────────────────────

class BrandCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    industry: Optional[str] = Field(None, max_length=150)
    status: str = Field(default="active", pattern=r"^(active|inactive)$")


class BrandRead(BaseModel):
    id: int
    name: str
    industry: Optional[str]
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


class BrandReadFull(BrandRead):
    social_accounts: list["SocialAccountRead"] = []
    assignments: list["BrandAssignmentRead"] = []


class SocialAccountCreate(BaseModel):
    platform: str = Field(..., pattern=r"^(instagram|facebook|whatsapp)$")
    platform_account_id: str = Field(..., min_length=1, max_length=255)
    access_token: Optional[str] = None


class SocialAccountRead(BaseModel):
    id: int
    brand_id: int
    platform: str
    platform_account_id: str
    model_config = {"from_attributes": True}


class BrandAssignmentCreate(BaseModel):
    department_id: int
    user_id: int


class BrandAssignmentRead(BaseModel):
    id: int
    brand_id: int
    department_id: int
    user_id: int
    model_config = {"from_attributes": True}


# ──────────────────────────── Brand CRUD ────────────────────────────

@router.post("/", response_model=BrandRead, status_code=201, summary="Create brand (Tier 1)")
async def create_brand(
    payload: BrandCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    existing = await db.execute(select(Brand).where(Brand.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Brand name already exists")

    brand = Brand(
        name=payload.name,
        industry=payload.industry,
        status=payload.status,
    )
    db.add(brand)
    await db.flush()
    await db.refresh(brand)
    return brand


@router.get("/", response_model=list[BrandRead], summary="List brands")
async def list_brands(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Brand).order_by(Brand.name))
    return result.scalars().all()


@router.get("/reports/queries", summary="Get brand query reports/analytics")
async def get_brand_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns brand-wise query report.
    """
    brands_result = await db.execute(select(Brand).order_by(Brand.name))
    brands = brands_result.scalars().all()

    tasks_result = await db.execute(
        select(Task)
        .options(selectinload(Task.assignee))
        .where(Task.brand_id.isnot(None))
        .order_by(Task.due_date.desc())
    )
    tasks = tasks_result.scalars().all()

    from collections import defaultdict
    brand_tasks = defaultdict(list)
    for t in tasks:
        brand_tasks[t.brand_id].append(t)

    reports = []
    for brand in brands:
        b_tasks = brand_tasks[brand.id]
        total = len(b_tasks)
        
        status_counts = {
            "yet_to_start": 0,
            "in_progress": 0,
            "in_review": 0,
            "completed": 0,
            "rework": 0,
        }
        for t in b_tasks:
            status = t.status.value if hasattr(t.status, "value") else str(t.status)
            if status in status_counts:
                status_counts[status] += 1

        queries_list = []
        for t in b_tasks:
            sender = "Unknown"
            message_text = t.description or ""
            platform = "Meta"
            
            if t.title.startswith("[") and "]" in t.title:
                try:
                    platform = t.title[1:t.title.index("]")]
                    if "Query from " in t.title:
                        sender = t.title[t.title.index("Query from ") + 11:]
                except Exception:
                    pass
            
            if "Message: " in message_text:
                try:
                    msg_part = message_text.split("Message: ", 1)[1]
                    if "\n\nRaw sender info:" in msg_part:
                        message_text = msg_part.split("\n\nRaw sender info:", 1)[0]
                    else:
                        message_text = msg_part
                except Exception:
                    pass

            queries_list.append({
                "id": t.id,
                "title": t.title,
                "platform": platform,
                "sender": sender,
                "message": message_text,
                "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
                "created_at": t.due_date - timedelta(hours=4),
                "assignee_name": f"{t.assignee.first_name} {t.assignee.last_name}" if t.assignee else "Unassigned",
                "progress_percentage": t.progress_percentage,
            })

        reports.append({
            "brand_id": brand.id,
            "brand_name": brand.name,
            "industry": brand.industry,
            "status": brand.status.value if hasattr(brand.status, "value") else str(brand.status),
            "total_queries": total,
            "status_distribution": status_counts,
            "queries": queries_list
        })

    return reports


@router.get("/{brand_id}", response_model=BrandReadFull, summary="Get brand detail")
async def get_brand(
    brand_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Brand)
        .options(
            selectinload(Brand.social_accounts),
            selectinload(Brand.assignments),
        )
        .where(Brand.id == brand_id)
    )
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    return brand


@router.patch("/{brand_id}", response_model=BrandRead, summary="Update brand (Tier 1)")
async def update_brand(
    brand_id: int,
    payload: BrandCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    brand.name = payload.name
    brand.industry = payload.industry
    brand.status = payload.status
    await db.flush()
    await db.refresh(brand)
    return brand


@router.delete("/{brand_id}", status_code=204, summary="Delete brand (Tier 1)")
async def delete_brand(
    brand_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    brand = result.scalar_one_or_none()
    if not brand:
        raise HTTPException(404, "Brand not found")
    await db.delete(brand)


# ──────────────────────────── Social Accounts ────────────────────────────

@router.post("/{brand_id}/social-accounts", response_model=SocialAccountRead, status_code=201,
             summary="Add social account to brand (Tier 1)")
async def add_social_account(
    brand_id: int,
    payload: SocialAccountCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Brand not found")

    account = SocialAccount(
        brand_id=brand_id,
        platform=payload.platform,
        platform_account_id=payload.platform_account_id,
        access_token=payload.access_token,
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


@router.delete("/{brand_id}/social-accounts/{account_id}", status_code=204,
               summary="Remove social account (Tier 1)")
async def remove_social_account(
    brand_id: int,
    account_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == account_id,
            SocialAccount.brand_id == brand_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Social account not found")
    await db.delete(account)


# ──────────────────────────── Brand Assignments ────────────────────────────

@router.post("/{brand_id}/assignments", response_model=BrandAssignmentRead, status_code=201,
             summary="Assign brand to dept+user (Tier 1)")
async def assign_brand(
    brand_id: int,
    payload: BrandAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    result = await db.execute(select(Brand).where(Brand.id == brand_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Brand not found")

    assignment = BrandAssignment(
        brand_id=brand_id,
        department_id=payload.department_id,
        user_id=payload.user_id,
    )
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)
    return assignment


@router.delete("/{brand_id}/assignments/{assignment_id}", status_code=204,
               summary="Remove brand assignment (Tier 1)")
async def remove_assignment(
    brand_id: int,
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    result = await db.execute(
        select(BrandAssignment).where(
            BrandAssignment.id == assignment_id,
            BrandAssignment.brand_id == brand_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(404, "Assignment not found")
    await db.delete(assignment)
