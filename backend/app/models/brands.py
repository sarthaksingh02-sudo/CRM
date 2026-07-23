"""
Brand-related SQLAlchemy models.
Brands → SocialAccounts → BrandAssignments → Tasks
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class SocialPlatform(str, enum.Enum):
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    WHATSAPP = "whatsapp"


class BrandStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


# ──────────────────────────── Brand ────────────────────────────

class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    industry: Mapped[str | None] = mapped_column(String(150), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(BrandStatus, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=BrandStatus.ACTIVE,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    social_accounts: Mapped[list["SocialAccount"]] = relationship(
        "SocialAccount", back_populates="brand", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["BrandAssignment"]] = relationship(
        "BrandAssignment", back_populates="brand", cascade="all, delete-orphan"
    )


# ──────────────────────────── SocialAccount ────────────────────────────

class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    brand_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("brands.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[str] = mapped_column(
        Enum(SocialPlatform, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    platform_account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    brand: Mapped["Brand"] = relationship("Brand", back_populates="social_accounts")


# ──────────────────────────── BrandAssignment ────────────────────────────

class BrandAssignment(Base):
    __tablename__ = "brand_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    brand_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("brands.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    # Relationships
    brand: Mapped["Brand"] = relationship("Brand", back_populates="assignments")
