# app/models.py
from __future__ import annotations

import enum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


# ---------------- Enums ----------------


class Role(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    staff = "staff"
    accountant = "accountant"
    viewer = "viewer"


class OrderStatus(str, enum.Enum):
    hali = "hali_boshlanmagan"
    jarayonda = "jarayonda"
    tayyor = "tayyor"
    topshirildi = "topshirildi"


class PaymentState(str, enum.Enum):
    UNPAID = "UNPAID"
    PARTIAL = "PARTIAL"
    PAID = "PAID"


class PayMethod(str, enum.Enum):
    naqd = "naqd"
    payme = "payme"
    terminal = "terminal"
    bank = "bank"
    o_tkazma = "o`tkazma"


class CustomerType(str, enum.Enum):
    office = "office"
    sns = "sns"
    consulting = "consulting"


class AttachmentKind(str, enum.Enum):
    translation = "translation"
    apostille = "apostille"
    notary = "notary"
    other = "other"


class AttachmentStatus(str, enum.Enum):
    pending_review = "pending_review"
    approved = "approved"
    rejected = "rejected"


# ---------------- Entities ----------------


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    city = Column(String)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True)
    email = Column(String, unique=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(Role), default=Role.manager, nullable=False)

    branch_id = Column(ForeignKey("branches.id"))
    branch = relationship(Branch)

    is_active = Column(Boolean, default=True, nullable=False)
    invited_at = Column(DateTime)
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    invite_token = Column(String, nullable=True)
    reset_token = Column(String, nullable=True)


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, index=True)
    note = Column(Text)


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)
    order_id = Column(
        Integer,
        ForeignKey("orders.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    author = Column(Text, nullable=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    order = relationship("Order", backref="comments")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)

    client_id = Column(ForeignKey("clients.id"), nullable=False)
    client = relationship(Client)

    branch_id = Column(ForeignKey("branches.id"))
    branch = relationship(Branch)

    manager_id = Column(ForeignKey("users.id"))
    manager = relationship(User)

    status = Column(Enum(OrderStatus), default=OrderStatus.hali)
    customer_type = Column(Enum(CustomerType))
    doc_type = Column(String)
    country = Column(String)
    payment_method = Column(Enum(PayMethod))

    created_at = Column(DateTime, server_default=func.now())
    deadline = Column(Date)

    total_amount = Column(Numeric(12, 2), default=0)
    notes = Column(Text)

    paid_amount = Column(Numeric(12, 2), default=0)
    payment_state = Column(Enum(PaymentState), default=PaymentState.UNPAID)
    deleted_at = Column(DateTime, nullable=True)

    payments = relationship(
        "Payment",
        back_populates="order",
        cascade="all,delete-orphan",
        passive_deletes=True,
    )
    attachments = relationship(
        "Attachment",
        back_populates="order",
        cascade="all,delete-orphan",
        passive_deletes=True,
        order_by="Attachment.id",
    )


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)

    order_id = Column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order = relationship("Order", back_populates="payments")

    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(Enum(PayMethod), nullable=False)
    paid_at = Column(Date, server_default=func.current_date())
    note = Column(String)


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True)

    order_id = Column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order = relationship("Order", back_populates="attachments")

    kind = Column(Enum(AttachmentKind), default=AttachmentKind.translation, nullable=False)
    status = Column(
        Enum(AttachmentStatus),
        default=AttachmentStatus.pending_review,
        nullable=False,
    )
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=True)
    mime = Column(String(100), nullable=True)
    size = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    uploaded_by_id = Column("uploaded_by", ForeignKey("users.id"), nullable=True)
    uploader = relationship("User", foreign_keys=[uploaded_by_id])

    reviewed_by_id = Column(ForeignKey("users.id"), nullable=True)
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id], post_update=True)
    reviewed_at = Column(DateTime)
    review_comment = Column(Text)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(ForeignKey("users.id"), nullable=True)
    user = relationship("User")
    branch_id = Column(ForeignKey("branches.id"), nullable=True)
    branch = relationship("Branch")
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class VerifiedDoc(Base):
    __tablename__ = "verified_docs"

    id = Column(Integer, primary_key=True)
    public_id = Column(
        String(36),
        unique=True,
        index=True,
        default=lambda: str(uuid4()),
    )
    order_id = Column(ForeignKey("orders.id"), nullable=True)

    doc_number = Column(String, nullable=False)
    doc_title = Column(String, nullable=False)
    translator_name = Column(String, nullable=False)
    issued_date = Column(Date, default=func.current_date())
    note_en = Column(
        String,
        default="This document is certified and verified by LINGUA TRANSLATION.",
    )

    is_active = Column(Boolean, default=True)
    qr_filename = Column(String, nullable=True)
