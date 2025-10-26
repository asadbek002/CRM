from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_session
from app.deps import require_roles
from app.services.audit import log_action

router = APIRouter(prefix="/payments", tags=["payments"])


def _ensure_payment_scope(order: models.Order, user: models.User) -> None:
    if user.role == models.Role.admin:
        return

    if user.role in {models.Role.manager, models.Role.accountant}:
        if user.branch_id and order.branch_id and order.branch_id != user.branch_id:
            raise HTTPException(status_code=403, detail="Branch access denied")
        return

    raise HTTPException(status_code=403, detail="Permission denied")


@router.post("/{order_id}", status_code=201)
def add_payment(
    order_id: int,
    payload: schemas.PaymentIn,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(
        require_roles(models.Role.admin, models.Role.manager, models.Role.accountant)
    ),
):
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _ensure_payment_scope(order, current_user)

    payment = models.Payment(
        order_id=order_id,
        amount=payload.amount,
        method=payload.method if isinstance(payload.method, str) else payload.method.value,
        paid_at=payload.paid_at,
        note=payload.note,
    )
    db.add(payment)
    db.flush()

    log_action(
        db,
        user=current_user,
        action="payment.create",
        entity_type="payment",
        entity_id=payment.id,
        branch_id=order.branch_id,
        extra={"order_id": order_id, "amount": float(payload.amount)},
    )

    # recalc
    paid = (
        db.query(func.coalesce(func.sum(models.Payment.amount), 0))
        .filter(models.Payment.order_id == order_id)
        .scalar()
        or 0
    )
    order.paid_amount = paid
    total = float(order.total_amount or 0)
    if paid <= 0:
        order.payment_state = models.PaymentState.UNPAID
    elif total > 0 and paid >= total:
        order.payment_state = models.PaymentState.PAID
    else:
        order.payment_state = models.PaymentState.PARTIAL

    db.commit()
    db.refresh(order)

    return {
        "ok": True,
        "paid_amount": float(order.paid_amount),
        "payment_state": order.payment_state.value,
    }
