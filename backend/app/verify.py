# app/routers/verify.py
# app/routers/verify.py
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from datetime import date as ddate
import os, qrcode

from app.database import get_session
from app import models
from app.config import VERIFY_BASE_URL, QR_DIR

router = APIRouter(prefix="/verify", tags=["verify"])

@router.post("/create")
def create_verified_doc(
    doc_number: str = Form(...),
    doc_title: str = Form(...),
    translator_name: str = Form(...),
    issued_date: str | None = Form(None),
    note_en: str | None = Form(None),
    order_id: int | None = Form(None),
    db: Session = Depends(get_session),
):
    # 1) trim va bo‘sh qiymatlarni tekshirish
    doc_number = (doc_number or "").strip()
    doc_title = (doc_title or "").strip()
    translator_name = (translator_name or "").strip()
    if not doc_number or not doc_title or not translator_name:
        raise HTTPException(status_code=422, detail="doc_number, doc_title, translator_name majburiy")

    # 2) issued_date -> Python date
    issued_dt = None
    if issued_date:
        try:
            issued_dt = ddate.fromisoformat(issued_date)  # YYYY-MM-DD
        except ValueError:
            raise HTTPException(status_code=422, detail="issued_date format YYYY-MM-DD bo‘lishi kerak")

    # 3) public_id va QR
    public_id = models.VerifiedDoc.gen_public_id()
    verify_url = f"{VERIFY_BASE_URL.rstrip('/')}/verify/{public_id}"

    os.makedirs(QR_DIR, exist_ok=True)
    qr_name = f"{public_id}.png"
    qr_path = os.path.join(QR_DIR, qr_name)
    img = qrcode.make(verify_url)
    img.save(qr_path)

    vd = models.VerifiedDoc(
        public_id=public_id,
        order_id=order_id,
        doc_number=doc_number,
        doc_title=doc_title,
        translator_name=translator_name,
        issued_date=issued_dt,               # <-- endi date obyekt
        note_en=note_en,
        is_active=True,
        qr_filename=qr_name,                 # saqlab qo‘yish foydali
    )
    db.add(vd)
    db.commit()
    db.refresh(vd)

    return {
        "id": vd.id,
        "public_id": vd.public_id,
        "verify_url": verify_url,
        "qr_image": f"/qr/{qr_name}",
    }

@router.get("/{public_id}")
def verify_view(public_id: str, db: Session = Depends(get_session)):
    vd = db.query(models.VerifiedDoc).filter(models.VerifiedDoc.public_id == public_id).first()
    if not vd or not vd.is_active:
        raise HTTPException(404, "Document not found or inactive")

    return {
        "doc_number": vd.doc_number,
        "doc_title": vd.doc_title,
        "translator_name": vd.translator_name,
        "issued_date": str(vd.issued_date),
        "note_en": vd.note_en,
        "status": "verified",
    }
