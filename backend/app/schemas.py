# app/schemas.py
from datetime import date, datetime
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, constr, field_validator, EmailStr


class LoginIn(BaseModel):
    username: str
    password: str


class ClientIn(BaseModel):
    full_name: str
    phone: constr(strip_whitespace=True, min_length=7)
    note: Optional[str] = None


class UserCreate(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[constr(strip_whitespace=True, min_length=5)] = None
    role: str
    branch_id: Optional[int] = None
    password: Optional[constr(min_length=6)] = None


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[constr(strip_whitespace=True, min_length=5)] = None
    role: Optional[str] = None
    branch_id: Optional[int] = None
    is_active: Optional[bool] = None
    password: Optional[constr(min_length=6)] = None


class UserOut(BaseModel):
    id: int
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    role: str
    branch_id: Optional[int]
    branch_name: Optional[str]
    is_active: bool
    invited_at: Optional[datetime]
    last_login_at: Optional[datetime]
    created_at: Optional[datetime]


class PaymentIn(BaseModel):
    amount: float
    method: str
    paid_at: Optional[date] = None
    note: Optional[str] = None


class OrderIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    client_id: int
    branch_id: Optional[int] = None
    manager_id: Optional[int] = Field(
        default=None, validation_alias="staff_id")
    status: Optional[str] = None
    customer_type: Optional[str] = None
    doc_type: Optional[str] = None
    country: Optional[str] = None
    payment_method: Optional[str] = None
    deadline: Optional[date] = None
    total_amount: float = 0
    notes: Optional[str] = None


# -------------------------------
# QR/Verified Document schemas
# -------------------------------

class VerifyCreateIn(BaseModel):
    doc_number: str
    doc_title: str
    translator_name: str
    issued_date: Optional[date] = None
    order_id: Optional[int] = None
    note_en: Optional[str] = None
    note_en: Optional[str] = "This document is certified and verified by LINGUA TRANSLATION."

    # Str bo'lib kelsa ham date ga aylantirib beradi
    @field_validator("issued_date", mode="before")
    @classmethod
    def _parse_issued_date(cls, v):
        if v in (None, "", 0):
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            try:
                return date.fromisoformat(v)  # "YYYY-MM-DD"
            except ValueError:
                raise ValueError(
                    "issued_date format YYYY-MM-DD bo'lishi kerak")
        return v


class VerifyOut(BaseModel):
    """Yaratilgandan keyin qaytariladigan javob."""
    id: int
    public_id: str
    public_url: str
    qr_filename: str
    qr_image_url: str


class PaymentStateUpdate(BaseModel):
    payment_state: str = Field(pattern="^(UNPAID|PARTIAL|PAID)$")


class OrderStatusUpdate(BaseModel):
    status: str = Field(
        pattern="^(hali_boshlanmagan|jarayonda|tayyor|topshirildi)$")


class CommentCreate(BaseModel):
    text: str
    author: str | None = None


class CommentOut(BaseModel):
    id: int
    order_id: int
    text: str
    author: str | None
    created_at: datetime

    class Config:
        orm_mode = True


class AttachmentReviewUpdate(BaseModel):
    status: str = Field(pattern="^(pending_review|approved|rejected)$")
    review_comment: Optional[str] = None


class PasswordResetIn(BaseModel):
    password: constr(min_length=6)


class AuditLogOut(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[int]
    details: Optional[str]
    created_at: datetime
    user_name: Optional[str] = None


class DashboardSummaryOut(BaseModel):
    orders_total: int
    orders_in_progress: int
    orders_completed: int
    orders_overdue: int
    payments_sum: float
    payments_debt: float
    files_pending: int
    files_rejected: int


class DashboardTimelinePoint(BaseModel):
    bucket: str
    orders: int
    payments: float


class DashboardTopItem(BaseModel):
    label: str
    value: int
