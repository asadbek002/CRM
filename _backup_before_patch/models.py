# app/models.py
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Date, DateTime, Enum, Numeric, Text, func, Boolean
)
from sqlalchemy.orm import declarative_base, relationship
from uuid import uuid4
import enum

Base = declarative_base()

# ---------------- Enums ----------------
class Role(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    viewer = "viewer"

class OrderStatus(str, enum.Enum):
    hali = "hali_boshlanmagan"
    jarayonda = "jarayonda"
    tayyor = "tayyor"
    topshirildi = "topshirildi"

class PayMethod(str, enum.Enum):
    naqd = "naqd"
    plastik = "plastik"
    payme = "payme"
    terminal = "terminal"

class CustomerType(str, enum.Enum):
    office = "office"
    sns = "sns"
    consulting = "consulting"

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
    role = Column(Enum(Role), default=Role.manager)

    branch_id = Column(ForeignKey("branches.id"))
    branch = relationship(Branch)

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, index=True)
    note = Column(Text)

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
        order_by="Attachment.id"
    )

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True)

    order_id = Column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    order = relationship("Order", back_populates="payments")

    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(Enum(PayMethod), nullable=False)
    paid_at = Column(Date, server_default=func.current_date())
    note = Column(String)

class Attachment(Base):
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True)

    order_id = Column(ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    order = relationship("Order", back_populates="attachments")

    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=True)
    mime = Column(String(100), nullable=True)
    size = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    uploaded_by = Column(ForeignKey("users.id"), nullable=True)

class VerifiedDoc(Base):
    __tablename__ = "verified_docs"

    id = Column(Integer, primary_key=True)
    public_id = Column(String(36), unique=True, index=True, default=lambda: str(uuid4()))
    order_id = Column(ForeignKey("orders.id"), nullable=True)

    doc_number = Column(String, nullable=False)
    doc_title = Column(String, nullable=False)
    translator_name = Column(String, nullable=False)
    issued_date = Column(Date, default=func.current_date())
    note_en = Column(String, default="This document is certified and verified by LINGUA TRANSLATION.")

    is_active = Column(Boolean, default=True)
    qr_filename = Column(String, nullable=True)
