from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, DiscussionMessage
from app.schemas.schemas import DiscussionCreate, DiscussionRead, DiscussionUpdate

router = APIRouter(prefix="/discussion", tags=["Discussion"])


async def get_discussion_message_with_relations(message_id: int, db: AsyncSession) -> Optional[DiscussionMessage]:
    stmt = (
        select(DiscussionMessage)
        .options(selectinload(DiscussionMessage.user).selectinload(User.department))
        .where(DiscussionMessage.id == message_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


@router.post("/", response_model=DiscussionRead, status_code=201, summary="Post a discussion message")
async def create_message(
    payload: DiscussionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    msg = DiscussionMessage(
        user_id=current_user.id,
        content=payload.content,
    )
    db.add(msg)
    await db.flush()
    # Eagerly load relationships so Pydantic can serialize without lazy loading errors
    full_msg = await get_discussion_message_with_relations(msg.id, db)
    return full_msg


@router.get("/", response_model=list[DiscussionRead], summary="Get recent discussion messages")
async def get_messages(
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DiscussionMessage)
        .options(selectinload(DiscussionMessage.user).selectinload(User.department))
        .order_by(DiscussionMessage.created_at.asc())
        .limit(limit)
    )
    return result.scalars().all()


@router.patch("/{message_id}", response_model=DiscussionRead, summary="Edit a discussion message")
async def update_message(
    message_id: int,
    payload: DiscussionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Eagerly load user and department to edit it
    msg = await get_discussion_message_with_relations(message_id, db)
    if not msg:
        raise HTTPException(404, "Message not found")
        
    if msg.user_id != current_user.id:
        raise HTTPException(403, "You can only edit your own messages")
        
    msg.content = payload.content
    msg.updated_at = datetime.now(timezone.utc)
    await db.flush()
    # Refresh to ensure any DB updates are reflected
    await db.refresh(msg)
    return msg


@router.delete("/{message_id}", status_code=204, summary="Delete a discussion message")
async def delete_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(DiscussionMessage).where(DiscussionMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message not found")
        
    if msg.user_id != current_user.id and current_user.role_tier > 2:
        raise HTTPException(403, "You do not have permission to delete this message")
        
    await db.delete(msg)

