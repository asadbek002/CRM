# app/routers/orders.py
from datetime import date
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func
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


# ------- helpers -------

def paid_sum(db: Session, order_id: int) -> float:
    """Berilgan order uchun jami to'langan summani qaytaradi."""
    return float(
        db.query(func.coalesce(func.sum(models.Payment.amount), 0))
        .filter(models.Payment.order_id == order_id)
        .scalar()
        or 0
    )


# ------- endpoints -------

@router.get("")
def list_orders(db: Session = Depends(get_session)):
    rows = (
        db.query(models.Order)
        .join(models.Client)
        .order_by(models.Order.id.desc())
        .all()
    )

    items = []
    for o in rows:
        paid = paid_sum(db, o.id)
        total = float(o.total_amount or 0)
        balance = total - paid

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
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "payment_status": status,
                "customer_type": getattr(o.customer_type, "value", None),
                "doc_type": o.doc_type,
                "country": o.country,
                "branch": o.branch.name if o.branch else None,
                "manager": o.manager.full_name if o.manager else None,
                "deadline": o.deadline.isoformat() if o.deadline else None,
                "total_amount": total,
                "paid_sum": paid,
                "balance": balance,
                "payment_method": getattr(o.payment_method, "value", None),
                "status": getattr(o.status, "value", o.status),
                "last_attachment": last_att,
            }
        )

    return {"total": len(items), "rows": items}


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_session)):
    """Bitta order tafsiloti (attachments va payments bilan)."""
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    paid = paid_sum(db, o.id)
    total = float(o.total_amount or 0)
    balance = total - paid

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
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "payment_status": pay_status,
        "customer_type": getattr(o.customer_type, "value", None),
        "doc_type": o.doc_type,
        "country": o.country,
        "branch": o.branch.name if o.branch else None,
        "manager": o.manager.full_name if o.manager else None,
        "deadline": o.deadline.isoformat() if o.deadline else None,
        "total_amount": total,
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
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in (o.attachments or [])
        ],
        "payments": [
            {
                "id": p.id,
                "amount": float(p.amount or 0),
                "method": getattr(p.method, "value", None),
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
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
