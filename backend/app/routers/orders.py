# -*- coding: utf-8 -*-
# app/routers/orders.py
from datetime import date, datetime, timedelta
import os
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import func, cast, Date as SA_Date
from sqlalchemy.orm import Session

from app.database import get_session
from app import models, schemas
from app.config import (
    UPLOAD_DIR,
    ALLOWED_MIME,
    ALLOWED_EXT,
    MAX_UPLOAD_MB,
    sanitize_filename,
)

router = APIRouter(prefix="/orders", tags=["orders"])

# ---------------- helpers ----------------

def paid_sum(db: Session, order_id: int) -> float:
    """Berilgan order uchun jami to'langan summani qaytaradi."""
    return float(
        db.query(func.coalesce(func.sum(models.Payment.amount), 0))
        .filter(models.Payment.order_id == order_id)
        .scalar()
        or 0
    )

# ---------------- endpoints ----------------

@router.get("")
def list_orders(
    db: Session = Depends(get_session),
    q: Optional[str] = None,
    # deadline bo‘yicha oraliq filtr
    deadline_from: Optional[date] = None,
    deadline_to: Optional[date] = None,
    # Yaratilgan sana bo‘yicha ham ixtiyoriy filtr (frontend hozir foydalanmayapti, lekin foydali)
    created_from: Optional[date] = None,
    created_to: Optional[date] = None,
    # boshqa filtrlashlar
    debt_only: bool = False,
    payment_state: Optional[str] = None,  # 'UNPAID'|'PARTIAL'|'PAID'
    # pagination & sorting
    page: int = 1,
    size: int = 50,
    sort_by: str = "id",
    sort_dir: str = "desc",
):
    qs = db.query(models.Order).join(models.Client)
    qs = qs.filter(models.Order.deleted_at.is_(None))

    if q:
        like = f"%{q}%"
        qs = qs.filter(
            (models.Client.full_name.ilike(like)) |
            (models.Client.phone.ilike(like))
        )

    # deadline bo‘yicha
    if deadline_from:
        qs = qs.filter(models.Order.deadline >= deadline_from)
    if deadline_to:
        qs = qs.filter(models.Order.deadline <= deadline_to)

    # created_at bo‘yicha (datetime -> kun diapazoni)
    if created_from:
        start_dt = datetime.combine(created_from, datetime.min.time())
        qs = qs.filter(models.Order.created_at >= start_dt)
    if created_to:
        end_dt = datetime.combine(created_to, datetime.min.time()) + timedelta(days=1)
        qs = qs.filter(models.Order.created_at < end_dt)

    # qarzdorlar (paid_amount ustuni mavjudligiga tayangan holda)
    if debt_only:
        qs = qs.filter(
            func.coalesce(models.Order.total_amount, 0) >
            func.coalesce(models.Order.paid_amount, 0)
        )

    # payment_state filtri
    if payment_state in ("UNPAID", "PARTIAL", "PAID"):
        from app.models import PaymentState as _PS
        qs = qs.filter(models.Order.payment_state == _PS[payment_state])

    # sort
    sort_col = getattr(models.Order, sort_by, models.Order.id)
    if sort_dir.lower() == "desc":
        sort_col = sort_col.desc()
    qs = qs.order_by(sort_col)

    total_count = qs.count()
    rows = qs.offset((page - 1) * size).limit(size).all()

    items = []
    for o in rows:
        paid = paid_sum(db, o.id)
        order_total = float(o.total_amount or 0)
        balance = order_total - paid

        if paid <= 0:
            status = "to'lanmagan"
        elif balance <= 0:
            status = "to'landi"
        else:
            status = "qisman"

        last_att = None
        if getattr(o, "attachments", None):
            a = o.attachments[-1]
            last_att = {
                "id": a.id,
                "display_name": a.original_name or a.filename,
                "size": (a.size or 0),
            }

        items.append(
            {
                "id": o.id,
                "client_name": o.client.full_name if o.client else None,
                "client_phone": o.client.phone if o.client else None,
                "created_at": o.created_at.strftime("%Y-%m-%d") if o.created_at else None,
                "payment_status": status,
                "customer_type": getattr(o.customer_type, "value", None),
                "doc_type": o.doc_type,
                "country": o.country,
                "branch": o.branch.name if o.branch else None,
                "manager": o.manager.full_name if o.manager else None,
                "deadline": o.deadline.strftime("%Y-%m-%d") if o.deadline else None,
                "total_amount": order_total,
                "paid_sum": paid,
                "balance": balance,
                "payment_method": getattr(o.payment_method, "value", None),
                "status": getattr(o.status, "value", o.status),
                "last_attachment": last_att,
            }
        )

    return {"total": total_count, "rows": items, "page": page, "size": size}


@router.get("/{order_id:int}")
def get_order(order_id: int, db: Session = Depends(get_session)):
    """Bitta order tafsiloti (attachments va payments bilan)."""
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    paid = paid_sum(db, o.id)
    order_total = float(o.total_amount or 0)
    balance = order_total - paid

    if paid <= 0:
        pay_status = "to'lanmagan"
    elif balance <= 0:
        pay_status = "to'landi"
    else:
        pay_status = "qisman"

    return {
        "id": o.id,
        "client_name": o.client.full_name if o.client else None,
        "client_phone": o.client.phone if o.client else None,
        "created_at": o.created_at.strftime("%Y-%m-%d") if o.created_at else None,
        "payment_status": pay_status,
        "customer_type": getattr(o.customer_type, "value", None),
        "doc_type": o.doc_type,
        "country": o.country,
        "branch": o.branch.name if o.branch else None,
        "manager": o.manager.full_name if o.manager else None,
        "deadline": o.deadline.strftime("%Y-%m-%d") if o.deadline else None,
        "total_amount": order_total,
        "paid_sum": paid,
        "balance": balance,
        "payment_method": getattr(o.payment_method, "value", None),
        "status": getattr(o.status, "value", o.status),
        "attachments": [
            {
                "id": a.id,
                "display_name": a.original_name or a.filename,
                "mime": a.mime,
                "size": a.size or 0,
                "created_at": a.created_at.strftime("%Y-%m-%d") if a.created_at else None,
            }
            for a in (o.attachments or [])
        ],
        "payments": [
            {
                "id": p.id,
                "amount": float(p.amount or 0),
                "method": getattr(p.method, "value", None),
                "paid_at": p.paid_at.strftime("%Y-%m-%d") if p.paid_at else None,
                "note": p.note,
            }
            for p in (o.payments or [])
        ],
    }


@router.post("", status_code=201)
def create_order(payload: schemas.OrderIn, db: Session = Depends(get_session)):
    if payload.deadline and payload.deadline < date.today():
        raise HTTPException(status_code=400, detail="deadline o'tmishda bo'lishi mumkin emas")

    o = models.Order(**payload.model_dump())
    db.add(o)
    db.commit()
    db.refresh(o)
    return {"id": o.id}


@router.get("/{order_id}/attachments")
def list_attachments(order_id: int, db: Session = Depends(get_session)):
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    return [
        {
            "id": a.id,
            "display_name": a.original_name or a.filename,
            "size": a.size or 0,
        }
        for a in (o.attachments or [])
    ]


@router.post("/{order_id}/upload", status_code=201)
def upload_for_order(
    order_id: int,
    f: UploadFile = File(...),
    db: Session = Depends(get_session),
):
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    # MIME tekshiruv
    if ALLOWED_MIME and f.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Kengaytma tekshiruv
    ext = ""
    if f.filename and "." in f.filename:
        ext = f.filename.rsplit(".", 1)[-1].lower()
    if ALLOWED_EXT and ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="File extension not allowed")

    # Hajm tekshiruv
    data = f.file.read()
    if MAX_UPLOAD_MB and len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    # Saqlash
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_orig = sanitize_filename(f.filename or "file")
    stored_name = f"{uuid4().hex}.{ext or 'bin'}"
    path = os.path.join(UPLOAD_DIR, stored_name)
    with open(path, "wb") as out:
        out.write(data)

    att = models.Attachment(
        order_id=o.id,
        filename=stored_name,
        original_name=safe_orig,
        mime=f.content_type,
        size=len(data),
    )
    db.add(att)
    db.commit()
    db.refresh(att)

    return {"id": att.id}


@router.patch("/{order_id}/payment-state")
def set_payment_state(order_id: int, payload: schemas.PaymentStateUpdate, db: Session = Depends(get_session)):
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    from app.models import PaymentState as _PS
    # nom bilan yoki qiymat bilan
    o.payment_state = _PS[payload.payment_state] if hasattr(_PS, payload.payment_state) else _PS(payload.payment_state)
    db.commit()
    db.refresh(o)
    return {"ok": True, "payment_state": o.payment_state.value}


@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_session)):
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    o.deleted_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.get("/by-date")
def orders_by_date(
    date: date = Query(..., description="YYYY-MM-DD"),
    mode: str = Query("created", regex="^(created|deadline)$"),
    db: Session = Depends(get_session),
):
    """
    Bir kunlik buyurtmalar:
    - mode='created'  -> created_at bo‘yicha (kun boshidan keyingi kun boshigacha)
    - mode='deadline' -> deadline bo‘yicha (aniq sana)
    Qaytuvchi format: list_orders() dagi bilan bir xil.
    """
    qs = (
        db.query(models.Order)
        .join(models.Client)
        .filter(models.Order.deleted_at.is_(None))
    )

    if mode == "created":
        start_dt = datetime.combine(date, datetime.min.time())
        end_dt = start_dt + timedelta(days=1)
        qs = qs.filter(models.Order.created_at >= start_dt,
                       models.Order.created_at < end_dt)
    else:
        # agar deadline datetime bo'lsa ham mos kelishi uchun cast qilamiz
        qs = qs.filter(cast(models.Order.deadline, SA_Date) == date)

    qs = qs.order_by(models.Order.id.desc())
    rows = qs.all()

    items = []
    for o in rows:
        # to'lovlar yig'indisi
        paid = paid_sum(db, o.id)
        order_total = float(o.total_amount or 0)
        balance = order_total - paid

        # payment_status (UI’dagi matn uchun)
        if paid <= 0:
            pay_status = "to'lanmagan"
        elif balance <= 0:
            pay_status = "to'landi"
        else:
            pay_status = "qisman"

        last_att = None
        if getattr(o, "attachments", None):
            a = o.attachments[-1]
            last_att = {
                "id": a.id,
                "display_name": a.original_name or a.filename,
                "size": (a.size or 0),
            }

        items.append(
            {
                "id": o.id,
                "client_name": o.client.full_name if o.client else None,
                "client_phone": o.client.phone if o.client else None,
                "created_at": o.created_at.strftime("%Y-%m-%d") if o.created_at else None,
                "payment_status": pay_status,
                "customer_type": getattr(o.customer_type, "value", None),
                "doc_type": o.doc_type,
                "country": o.country,
                "branch": o.branch.name if o.branch else None,
                "manager": o.manager.full_name if o.manager else None,
                "deadline": o.deadline.strftime("%Y-%m-%d") if o.deadline else None,
                "total_amount": order_total,
                "paid_sum": paid,
                "balance": balance,
                "payment_method": getattr(o.payment_method, "value", None),
                "status": getattr(o.status, "value", o.status),
                "last_attachment": last_att,
            }
        )

    return {"date": str(date), "total": len(items), "rows": items}


@router.get("/stats/payments")
def payment_stats(
    granularity: str = "daily",
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_session),
):
    """
    To'lovlar yig'indisini vaqt bo'yicha.
    SQLite uchun strftime ishlatiladi (dev.db).
    """
    if granularity not in ("daily", "weekly", "monthly"):
        granularity = "daily"

    fmt = {"daily": "%Y-%m-%d", "weekly": "%Y-%W", "monthly": "%Y-%m"}[granularity]

    q = db.query(
        func.strftime(fmt, models.Payment.paid_at).label("bucket"),
        func.coalesce(func.sum(models.Payment.amount), 0).label("sum"),
    )

    if date_from:
        q = q.filter(models.Payment.paid_at >= date_from)
    if date_to:
        # inclusive bo'lishi uchun keyingi kun boshigacha
        q = q.filter(models.Payment.paid_at < date_to + timedelta(days=1))

    q = q.group_by("bucket").order_by("bucket")
    rows = [{"bucket": b, "sum": float(s)} for b, s in q.all()]
    return {"granularity": granularity, "rows": rows}

