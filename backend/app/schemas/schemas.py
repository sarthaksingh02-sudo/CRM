from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


# ──────────────────────────── Auth Schemas ────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    sub: Optional[int] = None


# ──────────────────────────── Department Schemas ────────────────────────────

class DepartmentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentRead(DepartmentBase):
    id: int

    model_config = {"from_attributes": True}


# ──────────────────────────── User Schemas ────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role_tier: int = Field(..., ge=1, le=3)
    department_id: Optional[int] = None


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    role_tier: Optional[int] = Field(None, ge=1, le=3)
    department_id: Optional[int] = None


class UserRead(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role_tier: int
    department_id: Optional[int]
    is_active: bool
    department: Optional[DepartmentRead] = None

    model_config = {"from_attributes": True}


class UserDeactivate(BaseModel):
    is_active: bool = False


# ──────────────────────────── Task Schemas ────────────────────────────

class TaskCreate(BaseModel):
    brand_name: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = None
    priority: str = Field(default="medium", pattern=r"^(low|medium|high)$")
    department_id: int
    assigned_to: int
    due_date: datetime
    expected_delivery: datetime


class TaskUpdate(BaseModel):
    brand_name: Optional[str] = Field(None, min_length=1, max_length=200)
    title: Optional[str] = Field(None, min_length=1, max_length=300)
    description: Optional[str] = None
    priority: Optional[str] = Field(None, pattern=r"^(low|medium|high)$")
    expected_delivery: Optional[datetime] = None


class TaskStatusUpdate(BaseModel):
    """Used by Tier-2 heads to move task to completed or rework."""
    status: str = Field(..., pattern=r"^(completed|rework)$")
    rework_progress: Optional[int] = Field(None, ge=0, le=99)
    rework_comment: Optional[str] = None

    @model_validator(mode="after")
    def rework_requires_comment(self) -> "TaskStatusUpdate":
        if self.status == "rework":
            if not self.rework_comment:
                raise ValueError("rework_comment is mandatory when setting status to rework")
            if self.rework_progress is None:
                raise ValueError("rework_progress must be specified when setting status to rework")
        return self


class TaskProgressUpdate(BaseModel):
    """Used by Tier-3 staff to slide progress percentage."""
    progress_percentage: int = Field(..., ge=1, le=99)


class TaskAssigneeStartUpdate(BaseModel):
    """Assignee triggers in_progress."""
    pass  # No body needed – endpoint derives action from current state


class TaskRead(BaseModel):
    id: int
    brand_name: str
    title: str
    description: Optional[str]
    status: str
    progress_percentage: int
    priority: str
    department_id: int
    assigned_to: int
    assigned_by: int
    due_date: datetime
    expected_delivery: datetime
    is_overdue: bool
    department: Optional[DepartmentRead] = None
    assignee: Optional[UserRead] = None
    assigner: Optional[UserRead] = None

    model_config = {"from_attributes": True}


# ──────────────────────────── Comment Schemas ────────────────────────────

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)


class CommentRead(BaseModel):
    id: int
    task_id: int
    user_id: int
    content: str
    created_at: datetime
    user: Optional[UserRead] = None

    model_config = {"from_attributes": True}


# ──────────────────────────── Attachment Schemas ────────────────────────────

class AttachmentRead(BaseModel):
    id: int
    task_id: int
    uploader_id: int
    file_name: str
    file_url: str

    model_config = {"from_attributes": True}


# ──────────────────────────── Audit Log Schemas ────────────────────────────

class AuditLogRead(BaseModel):
    id: int
    task_id: int
    user_id: int
    action_type: str
    old_value: Optional[str]
    new_value: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────── Dashboard / Metrics Schemas ────────────────────────────

class DepartmentMetrics(BaseModel):
    department_id: int
    department_name: str
    total_tasks: int
    completed: int
    in_progress: int
    overdue: int
    avg_progress: float


class PersonalMetrics(BaseModel):
    total_assigned: int
    completed: int
    in_progress: int
    in_review: int
    overdue: int
    avg_progress: float
