import enum
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


# ──────────────────────────── Enums ────────────────────────────

class RoleTier(int, enum.Enum):
    EXECUTIVE_ADMIN = 1
    DEPARTMENT_HEAD = 2
    STAFF = 3


class TaskStatus(str, enum.Enum):
    YET_TO_START = "yet_to_start"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"
    REWORK = "rework"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# ──────────────────────────── Department ────────────────────────────

class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)

    # Relationships
    users: Mapped[list["User"]] = relationship("User", back_populates="department", passive_deletes="all")
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="department", passive_deletes="all")


# ──────────────────────────── User ────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role_tier: Mapped[int] = mapped_column(
        Enum(RoleTier, values_callable=lambda obj: [str(e.value) for e in obj]),
        nullable=False,
        default=RoleTier.STAFF,
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    department: Mapped["Department | None"] = relationship("Department", back_populates="users")
    assigned_tasks: Mapped[list["Task"]] = relationship(
        "Task", foreign_keys="Task.assigned_to", back_populates="assignee", passive_deletes="all"
    )
    created_tasks: Mapped[list["Task"]] = relationship(
        "Task", foreign_keys="Task.assigned_by", back_populates="assigner", passive_deletes="all"
    )
    comments: Mapped[list["TaskComment"]] = relationship("TaskComment", back_populates="user", passive_deletes="all")
    attachments: Mapped[list["TaskAttachment"]] = relationship(
        "TaskAttachment", back_populates="uploader", passive_deletes="all"
    )
    audit_logs: Mapped[list["TaskAuditLog"]] = relationship(
        "TaskAuditLog", back_populates="user", passive_deletes="all"
    )


# ──────────────────────────── Task ────────────────────────────

class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("progress_percentage >= 0 AND progress_percentage <= 100", name="chk_progress_range"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    brand_name: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        Enum(TaskStatus, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=TaskStatus.YET_TO_START,
    )
    progress_percentage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    priority: Mapped[str] = mapped_column(
        Enum(TaskPriority, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=TaskPriority.MEDIUM,
    )

    department_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False
    )
    assigned_to: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    assigned_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expected_delivery: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_overdue: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    department: Mapped["Department"] = relationship("Department", back_populates="tasks")
    assignee: Mapped["User"] = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_tasks")
    assigner: Mapped["User"] = relationship("User", foreign_keys=[assigned_by], back_populates="created_tasks")
    comments: Mapped[list["TaskComment"]] = relationship(
        "TaskComment", back_populates="task", cascade="all, delete-orphan"
    )
    attachments: Mapped[list["TaskAttachment"]] = relationship(
        "TaskAttachment", back_populates="task", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[list["TaskAuditLog"]] = relationship(
        "TaskAuditLog", back_populates="task", cascade="all, delete-orphan"
    )


# ──────────────────────────── TaskComment ────────────────────────────

class TaskComment(Base):
    __tablename__ = "task_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    task: Mapped["Task"] = relationship("Task", back_populates="comments")
    user: Mapped["User"] = relationship("User", back_populates="comments")


# ──────────────────────────── TaskAttachment ────────────────────────────

class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    uploader_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)

    task: Mapped["Task"] = relationship("Task", back_populates="attachments")
    uploader: Mapped["User"] = relationship("User", back_populates="attachments")


# ──────────────────────────── TaskAuditLog ────────────────────────────

class TaskAuditLog(Base):
    __tablename__ = "task_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    action_type: Mapped[str] = mapped_column(String(100), nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )

    task: Mapped["Task"] = relationship("Task", back_populates="audit_logs")
    user: Mapped["User"] = relationship("User", back_populates="audit_logs")
