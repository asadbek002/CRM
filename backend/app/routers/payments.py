from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_session
from app import models, schemas

router = APIRouter(prefix="/payments", tags=["payments"])

@router.post("/{order_id}", status_code=201)
def add_payment(order_id: int, payload: schemas.PaymentIn, db: Session = Depends(get_session)):
    o = db.get(models.Order, order_id)
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    p = models.Payment(
        order_id=order_id,
        amount=payload.amount,
        method=payload.method if isinstance(payload.method, str) else payload.method.value,
        paid_at=payload.paid_at,
        note=payload.note,
    )
    db.add(p)
    db.commit()

    # recalc
    paid = db.query(func.coalesce(func.sum(models.Payment.amount), 0)).filter(models.Payment.order_id == order_id).scalar() or 0
    o.paid_amount = paid
    total = float(o.total_amount or 0)
    if paid <= 0:
        o.payment_state = models.PaymentState.UNPAID
    elif total > 0 and paid >= total:
        o.payment_state = models.PaymentState.PAID
    else:
        o.payment_state = models.PaymentState.PARTIAL

    db.commit()
    db.refresh(o)
    return {"ok": True, "paid_amount": float(o.paid_amount), "payment_state": o.payment_state.value}
