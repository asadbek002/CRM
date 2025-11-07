# app/routers/verify.py
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_session
from app.models import VerifiedDoc
from app.config import QR_DIR, VERIFY_BASE_URL, API_PREFIX

router = APIRouter(prefix="/verify", tags=["verify"])


@router.post("/create")
def create_verified_doc(
    doc_number: str = Form(...),
    doc_title: str = Form(...),
    translator_name: str = Form(...),
    issued_date: str = Form(...),  # YYYY-MM-DD
    note_en: str = Form(
        "This document is certified and verified by LINGUA TRANSLATION."),
    order_id: int | None = Form(None),
    db: Session = Depends(get_session),
):
    # 1) Проверяем формат даты
    try:
        issued_date_obj = datetime.strptime(issued_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # 2) Создаем запись
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

    # 3) Публичная ссылка проверки
    verify_url = f"{VERIFY_BASE_URL}/{vd.public_id}"

    # 4) Генерируем QR PNG в QR_DIR
    filename = f"qr_{vd.public_id}.png"
    path: Path = QR_DIR / filename
    path.parent.mkdir(parents=True, exist_ok=True)

    img = qrcode.make(verify_url)
    img.save(str(path))

    # 5) Сохраняем имя файла
    vd.qr_filename = filename
    db.commit()
    db.refresh(vd)

    # 6) Возвращаем ссылки
    return {
        "ok": True,
        "id": vd.id,
        "public_id": vd.public_id,
        "verify_url": verify_url,
        # пути теперь под /api/
        "qr_image": f"{API_PREFIX}/verify/qr/{vd.public_id}.png",
        "qr_download": f"{API_PREFIX}/verify/qr/{vd.public_id}/download",
    }


@router.get("/{public_id}")
def check_verified_doc(public_id: str, db: Session = Depends(get_session)):
    vd = (
        db.query(VerifiedDoc)
        .filter(VerifiedDoc.public_id == public_id, VerifiedDoc.is_active == True)
        .first()
    )
    if not vd:
        raise HTTPException(
            status_code=404, detail="Document not found or inactive")

    return {
        "doc_number": vd.doc_number,
        "doc_title": vd.doc_title,
        "translator_name": vd.translator_name,
        "issued_date": str(vd.issued_date),
        "verified": True,
        "note_en": vd.note_en,
        "organization": "LINGUA TRANSLATION",
    }


@router.get("/qr/{public_id}.png")
def get_qr_png(public_id: str):
    """Просмотр QR как картинки (для <img src="...">)."""
    safe_name = f"qr_{public_id}.png"
    path = QR_DIR / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="QR not found")
    return FileResponse(str(path), media_type="image/png")


@router.get("/qr/{public_id}/download")
def download_qr(public_id: str):
    """Принудительное скачивание PNG."""
    safe_name = f"qr_{public_id}.png"
    path = QR_DIR / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="QR not found")
    return FileResponse(
        str(path),
        media_type="image/png",
        filename=safe_name,
    )
