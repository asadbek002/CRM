import os, uuid, hashlib
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from app.database import get_session
from app import models
from app.config import UPLOAD_DIR, MAX_UPLOAD_MB, ALLOWED_MIME
try: import magic
except Exception: magic=None
router=APIRouter(prefix="/orders",tags=["attachments"])
def _sha256(b:bytes)->str: import hashlib; h=hashlib.sha256(); h.update(b); return h.hexdigest()
@router.post("/{order_id}/attachments", status_code=201)
async def upload_attachment(order_id:int, file:UploadFile=File(...), kind:str=Form("other"), db:Session=Depends(get_session)):
    order=db.query(models.Order).get(order_id)
    if not order: raise HTTPException(404,"order topilmadi")
    data=await file.read(); 
    if len(data)/(1024*1024)>MAX_UPLOAD_MB: raise HTTPException(413,f"fayl juda katta (> {MAX_UPLOAD_MB} MB)")
    mime = magic.from_buffer(data, mime=True) if magic else (file.content_type or "application/octet-stream")
    if mime not in ALLOWED_MIME: raise HTTPException(400,"faqat JPG yoki PDF ruxsat")
    ext=".jpg" if mime=="image/jpeg" else ".pdf"
    subdir=f"orders/{order_id}"; os.makedirs(os.path.join(UPLOAD_DIR,subdir), exist_ok=True)
    fname=f"{uuid.uuid4().hex}{ext}"; storage=os.path.join(UPLOAD_DIR,subdir,fname)
    with open(storage,"wb") as f: f.write(data)
    if kind=="initial_doc":
        ex=db.query(models.Attachment).filter_by(order_id=order_id, kind="initial_doc").first()
        if ex:
            try: os.remove(ex.storage_key)
            except Exception: pass
            db.delete(ex); db.commit()
    att=models.Attachment(order_id=order_id, kind=kind, original_name=file.filename, mime=mime, size_bytes=len(data), storage_key=storage, checksum_sha256=_sha256(data), uploaded_by=order.manager_id)
    db.add(att); db.commit(); return {"ok":True,"id":att.id,"url":f"/files/{subdir}/{fname}"}
@router.get("/{order_id}/attachments")
def list_attachments(order_id:int, db:Session=Depends(get_session)):
    return db.query(models.Attachment).filter_by(order_id=order_id).order_by(models.Attachment.id.desc()).all()
