from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from passlib.context import CryptContext

from app.core.database import get_db
from app.core.security import get_current_user, require_tier1, require_tier2
from app.models.user import User
from app.schemas.schemas import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED,
             summary="Create a new user (Tier 1 only)")
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=pwd_context.hash(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        role_tier=payload.role_tier,
        department_id=payload.department_id,
    )
    db.add(user)
    await db.flush()
    # Re-query with eager-loaded relationship to avoid MissingGreenlet on serialization
    result2 = await db.execute(
        select(User).options(selectinload(User.department)).where(User.id == user.id)
    )
    return result2.scalar_one()


@router.get("/", response_model=list[UserRead], summary="List users")
async def list_users(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(User).options(selectinload(User.department))
    if active_only:
        q = q.where(User.is_active == True)
    if current_user.role_tier == 2 and current_user.department_id:
        q = q.where(User.department_id == current_user.department_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/me", response_model=UserRead, summary="Current user profile")
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/{user_id}", response_model=UserRead, summary="Get user by ID")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(User).options(selectinload(User.department)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role_tier == 3 and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return user


@router.patch("/{user_id}", response_model=UserRead, summary="Update user (Tier 1 admin)")
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.flush()
    result2 = await db.execute(
        select(User).options(selectinload(User.department)).where(User.id == user_id)
    )
    return result2.scalar_one()


@router.patch("/{user_id}/deactivate", response_model=UserRead,
              summary="Soft-delete (deactivate) user – Tier 1 only")
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_tier1),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.flush()
    result2 = await db.execute(
        select(User).options(selectinload(User.department)).where(User.id == user_id)
    )
    return result2.scalar_one()


@router.patch("/{user_id}/reactivate", response_model=UserRead,
              summary="Re-activate a previously deactivated user – Tier 1 only")
async def reactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_tier1),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_active:
        raise HTTPException(status_code=409, detail="User is already active")
    user.is_active = True
    await db.flush()
    result2 = await db.execute(
        select(User).options(selectinload(User.department)).where(User.id == user_id)
    )
    return result2.scalar_one()
