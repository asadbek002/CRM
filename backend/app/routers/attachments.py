# app/routers/attachments.py
import os, mimetypes
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_session
from app import models
from app.config import UPLOAD_DIR

router = APIRouter(prefix="/attachments", tags=["attachments"])

@router.get("/{attachment_id}/download")
def download_attachment(attachment_id: int, db: Session = Depends(get_session)):
    att = db.get(models.Attachment, attachment_id)  # SQLAlchemy 2.x
    if not att:
        raise HTTPException(404, "Attachment not found")

    # serverda saqlangan nomni normalizatsiya qilamiz
    stored_name = os.path.basename(att.filename or "")
    path = os.path.join(UPLOAD_DIR, stored_name)
    if not os.path.exists(path):
        raise HTTPException(404, "File missing")

    media_type = att.mime or (mimetypes.guess_type(stored_name)[0] or "application/octet-stream")
    # FileResponse 'filename=' Content-Disposition headerini to¡®g¡®ri qo¡®yadi
    return FileResponse(path, media_type=media_type, filename=att.original_name or stored_name)

@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(attachment_id: int, db: Session = Depends(get_session)):
    att = db.get(models.Attachment, attachment_id)  # SQLAlchemy 2.x
    if not att:
        raise HTTPException(404, "Attachment not found")

    stored_name = os.path.basename(att.filename or "")
    path = os.path.join(UPLOAD_DIR, stored_name)
    try:
        if os.path.exists(path):
            os.remove(path)
    finally:
        db.delete(att)
        db.commit()
    return None  # 204
