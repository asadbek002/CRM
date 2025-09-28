# app/schemas.py
from pydantic import BaseModel, constr, Field, ConfigDict, field_validator
from datetime import date
from typing import Optional

class LoginIn(BaseModel):
    username: str
    password: str

class ClientIn(BaseModel):
    full_name: str
    phone: constr(strip_whitespace=True, min_length=7)
    note: Optional[str] = None

class PaymentIn(BaseModel):
    amount: float
    method: str
    paid_at: Optional[date] = None
    note: Optional[str] = None

class OrderIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    client_id: int
    branch_id: Optional[int] = None
    manager_id: Optional[int] = Field(default=None, validation_alias="staff_id")
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
                raise ValueError("issued_date format YYYY-MM-DD bo'lishi kerak")
        return v


class VerifyOut(BaseModel):
    """Yaratilgandan keyin qaytariladigan javob."""
    id: int
    public_id: str
    public_url: str
    qr_filename: str
    qr_image_url: str
