from datetime import datetime, timezone
from typing import Any, Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


def create_access_token(data: dict[str, Any], expires_delta: Optional[int] = None) -> str:
    import time

    to_encode = data.copy()
    expire_ts = int(time.time()) + (expires_delta or settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    to_encode["exp"] = expire_ts
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: Optional[int] = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Eagerly load department to prevent MissingGreenlet during response serialization
    result = await db.execute(
        select(User)
        .options(selectinload(User.department))
        .where(User.id == int(user_id))
    )
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user



def require_tier(max_tier: int):
    """Dependency factory: ensures caller's role_tier <= max_tier (lower = more privileged)."""

    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role_tier > max_tier:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role tier {max_tier} or higher privilege",
            )
        return current_user

    return _check


require_tier1 = require_tier(1)
require_tier2 = require_tier(2)
require_tier3 = require_tier(3)  # All authenticated active users
