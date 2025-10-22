# -*- coding: utf-8 -*-
# app/routers/orders.py
from datetime import date, datetime, timedelta
from collections import defaultdict
import os
from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import func, cast, Date as SA_Date, or_, and_
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

PAYMENT_STATE_LABELS = {
    "UNPAID": "to'lanmagan",
    "PARTIAL": "qisman to'langan",
    "PAID": "to'liq to'langan",
}


def resolve_payment_state(total: float, paid: float) -> str:
    """Calculate payment state name from total and paid amounts."""
    total = float(total or 0)
    paid = float(paid or 0)

    if paid <= 0:
        return "UNPAID"

    # Agar umumiy summa 0 bo'lsa va to'lov qilingan bo'lsa — to'liq to'langan, aks holda qisman
    if total <= 0:
        return "PAID"

    if paid + 0.01 >= total:
        return "PAID"

    return "PARTIAL"

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
    payments_sum = (
        db.query(
            models.Payment.order_id.label("order_id"),
            func.coalesce(func.sum(models.Payment.amount), 0).label("paid_amount"),
        )
        .group_by(models.Payment.order_id)
        .subquery()
    )

    paid_amount_col = func.coalesce(payments_sum.c.paid_amount, 0)
    total_amount_col = func.coalesce(models.Order.total_amount, 0)

    qs = (
        db.query(models.Order, paid_amount_col.label("paid_sum"))
        .join(models.Client)
        .outerjoin(payments_sum, payments_sum.c.order_id == models.Order.id)
    )
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
        qs = qs.filter(total_amount_col > paid_amount_col)

    # payment_state filtri
    if payment_state in ("UNPAID", "PARTIAL", "PAID"):
        from app.models import PaymentState as _PS
        stored_filter = models.Order.payment_state == _PS[payment_state]

        if payment_state == "UNPAID":
            computed_filter = and_(
                models.Order.payment_state.is_(None),
                paid_amount_col <= 0,
            )
        elif payment_state == "PAID":
            computed_filter = and_(
                models.Order.payment_state.is_(None),
                or_(
                    total_amount_col <= 0,
                    paid_amount_col + 0.01 >= total_amount_col,
                ),
            )
        else:  # PARTIAL
            computed_filter = and_(
                models.Order.payment_state.is_(None),
                paid_amount_col > 0,
                paid_amount_col + 0.01 < total_amount_col,
            )

        qs = qs.filter(or_(stored_filter, computed_filter))

    # sort
    sort_col = getattr(models.Order, sort_by, models.Order.id)
    if sort_dir.lower() == "desc":
        sort_col = sort_col.desc()
    total_count = qs.order_by(None).count()

    rows = (
        qs.order_by(sort_col)
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    items = []
    for o, paid in rows:
        order_total = float(o.total_amount or 0)
        paid_val = float(paid or 0)
        balance = order_total - paid_val
        if abs(balance) < 0.01:
            balance = 0.0

        stored_state = getattr(o.payment_state, "value", None)
        auto_state = resolve_payment_state(order_total, paid_val)
        state_value = stored_state if stored_state in PAYMENT_STATE_LABELS else auto_state

        status = PAYMENT_STATE_LABELS.get(state_value, state_value)

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
                "payment_state": stored_state if stored_state in PAYMENT_STATE_LABELS else state_value,
                "customer_type": getattr(o.customer_type, "value", None),
                "doc_type": o.doc_type,
                "country": o.country,
                "branch": o.branch.name if o.branch else None,
                "manager": o.manager.full_name if o.manager else None,
                "deadline": o.deadline.strftime("%Y-%m-%d") if o.deadline else None,
                "total_amount": order_total,
                "paid_sum": paid_val,
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

    stored_state = getattr(o.payment_state, "value", None)
    auto_state = resolve_payment_state(order_total, paid)
    state_value = stored_state if stored_state in PAYMENT_STATE_LABELS else auto_state
    pay_status = PAYMENT_STATE_LABELS.get(state_value, state_value)

    return {
        "id": o.id,
        "client_name": o.client.full_name if o.client else None,
        "client_phone": o.client.phone if o.client else None,
        "created_at": o.created_at.strftime("%Y-%m-%d") if o.created_at else None,
        "payment_status": pay_status,
        "payment_state": stored_state if stored_state in PAYMENT_STATE_LABELS else state_value,
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

        stored_state = getattr(o.payment_state, "value", None)
        auto_state = resolve_payment_state(order_total, paid)
        state_value = stored_state if stored_state in PAYMENT_STATE_LABELS else auto_state
        pay_status = PAYMENT_STATE_LABELS.get(state_value, state_value)

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
                "payment_state": stored_state if stored_state in PAYMENT_STATE_LABELS else state_value,
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
    Kunlik/haftalik/oylik kesimda buyurtmalar bo'yicha to'lov statistikasini qaytaradi.
    Natijada har bir davr uchun umumiy to'langan summa va to'lov holatlari bo'yicha
    kesim beriladi.
    """
    if granularity not in ("daily", "weekly", "monthly"):
        granularity = "daily"

    fmt_map = {"daily": "%Y-%m-%d", "weekly": "%Y-%W", "monthly": "%Y-%m"}
    fmt = fmt_map[granularity]

    dialect_name = getattr(getattr(db, "bind", None), "dialect", None)
    dialect_name = getattr(dialect_name, "name", "sqlite") if dialect_name else "sqlite"

    if dialect_name == "postgresql":
        trunc_unit = {"daily": "day", "weekly": "week", "monthly": "month"}[granularity]
        fmt_pg = {"daily": "YYYY-MM-DD", "weekly": "IYYY-IW", "monthly": "YYYY-MM"}[granularity]
        bucket_expr = func.to_char(func.date_trunc(trunc_unit, models.Order.created_at), fmt_pg)
    else:
        bucket_expr = func.strftime(fmt, models.Order.created_at)

    bucket_expr = bucket_expr.label("bucket")

    payments_sum = (
        db.query(
            models.Payment.order_id.label("order_id"),
            func.coalesce(func.sum(models.Payment.amount), 0).label("paid_amount"),
        )
        .group_by(models.Payment.order_id)
        .subquery()
    )

    q = (
        db.query(
            bucket_expr,
            models.Order.id,
            func.coalesce(models.Order.total_amount, 0).label("total_amount"),
            func.coalesce(payments_sum.c.paid_amount, 0).label("paid_amount"),
            models.Order.payment_state,
        )
        .outerjoin(payments_sum, payments_sum.c.order_id == models.Order.id)
        .filter(models.Order.deleted_at.is_(None))
    )

    if date_from:
        start_dt = datetime.combine(date_from, datetime.min.time())
        q = q.filter(models.Order.created_at >= start_dt)
    if date_to:
        end_dt = datetime.combine(date_to, datetime.min.time()) + timedelta(days=1)
        q = q.filter(models.Order.created_at < end_dt)

    q = q.order_by(bucket_expr, models.Order.id)

    def make_state_bucket():
        return {
            key: {"count": 0, "total_amount": 0.0, "paid_amount": 0.0, "balance": 0.0}
            for key in PAYMENT_STATE_LABELS.keys()
        }

    buckets = defaultdict(
        lambda: {
            "bucket": "",
            "sum": 0.0,
            "orders": 0,
            "total_amount": 0.0,
            "states": make_state_bucket(),
        }
    )

    for bucket, _order_id, total_amount, paid_amount, stored_state in q.all():
        bucket_key = bucket or "noma'lum"
        bucket_data = buckets[bucket_key]
        bucket_data["bucket"] = bucket_key
        bucket_data["orders"] += 1

        total_val = float(total_amount or 0)
        paid_val = float(paid_amount or 0)
        bucket_data["sum"] += paid_val
        bucket_data["total_amount"] += total_val

        stored_value = getattr(stored_state, "value", None)
        auto_value = resolve_payment_state(total_val, paid_val)
        state_value = stored_value if stored_value in PAYMENT_STATE_LABELS else auto_value

        state_bucket = bucket_data["states"].setdefault(
            state_value,
            {"count": 0, "total_amount": 0.0, "paid_amount": 0.0, "balance": 0.0},
        )

        state_bucket["count"] += 1
        state_bucket["total_amount"] += total_val
        state_bucket["paid_amount"] += paid_val
        balance_val = total_val - paid_val
        if abs(balance_val) < 0.01:
            balance_val = 0.0
        state_bucket["balance"] += balance_val

    rows = []
    for bucket_key in sorted(buckets.keys()):
        data = buckets[bucket_key]
        states_payload = {}
        for key in PAYMENT_STATE_LABELS.keys():
            info = data["states"].get(key, {"count": 0, "total_amount": 0.0, "paid_amount": 0.0, "balance": 0.0})
            states_payload[key] = {
                "count": int(info["count"]),
                "total_amount": round(info["total_amount"], 2),
                "paid_amount": round(info["paid_amount"], 2),
                "balance": round(info["balance"], 2),
            }

        rows.append(
            {
                "bucket": data["bucket"],
                "sum": round(data["sum"], 2),
                "orders": data["orders"],
                "total_amount": round(data["total_amount"], 2),
                "states": states_payload,
            }
        )

    return {"granularity": granularity, "rows": rows}

