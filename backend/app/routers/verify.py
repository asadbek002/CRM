from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from app.database import get_session
from app.models import VerifiedDoc
from app.config import QR_DIR, VERIFY_BASE_URL
import qrcode, os
from datetime import datetime

router = APIRouter(prefix="/verify", tags=["verify"])

@router.post("/create")
def create_verified_doc(
    doc_number: str = Form(...),
    doc_title: str = Form(...),
    translator_name: str = Form(...),
    issued_date: str = Form(...),  # "YYYY-MM-DD"
    note_en: str = Form("This document is certified and verified by LINGUA TRANSLATION."),
    order_id: int | None = Form(None),
    db: Session = Depends(get_session),
    # agar faqat admin/manager kirishi kerak bo��lsa, shu yerga auth dependency qo��shing:
    # current_user: User = Depends(require_manager_or_admin)
):
    # Convert string date to date object
    try:
        issued_date_obj = datetime.strptime(issued_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    vd = VerifiedDoc(
        doc_number=doc_number,
        doc_title=doc_title,
        translator_name=translator_name,
        issued_date=issued_date_obj,
        note_en=note_en,
        order_id=order_id,
    )
    db.add(vd)
    db.commit()
    db.refresh(vd)

    # QR link (public_id bilan)
    url = f"{VERIFY_BASE_URL}/{vd.public_id}"

    # QR rasmni saqlaymiz
    filename = f"qr_{vd.public_id}.png"
    path = os.path.join(QR_DIR, filename)
    img = qrcode.make(url)
    img.save(path)

    vd.qr_filename = filename
    db.commit()
    db.refresh(vd)

    return {
        "ok": True,
        "id": vd.id,
        "public_id": vd.public_id,
        "verify_url": url,
        "qr_image": f"/static/qr/{filename}",
    }

@router.get("/{public_id}")
def check_verified_doc(public_id: str, db: Session = Depends(get_session)):
    vd = db.query(VerifiedDoc).filter(
        VerifiedDoc.public_id == public_id,
        VerifiedDoc.is_active == True
    ).first()
    if not vd:
        raise HTTPException(status_code=404, detail="Document not found or inactive")

    return {
        "doc_number": vd.doc_number,
        "doc_title": vd.doc_title,
        "translator_name": vd.translator_name,
        "issued_date": str(vd.issued_date),
        "verified": True,
        "note_en": vd.note_en,
        "organization": "LINGUA TRANSLATION",
    }
