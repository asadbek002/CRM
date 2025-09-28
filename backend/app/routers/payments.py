from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_session
from app import models, schemas
router=APIRouter(prefix="/payments",tags=["payments"])
@router.post("/{order_id}", status_code=201)
def add_payment(order_id:int, payload: schemas.PaymentIn, db:Session=Depends(get_session)):
    p=models.Payment(order_id=order_id, amount=payload.amount, method=payload.method, paid_at=payload.paid_at, note=payload.note)
    db.add(p); db.commit(); return {"ok":True}
