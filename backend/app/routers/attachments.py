# app/routers/attachments.py
import mimetypes
import os
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import ATTACHMENTS_ROOT, UPLOAD_DIR
from app.database import get_session
from app.deps import get_current_user, require_roles
from app.services.audit import log_action

router = APIRouter(prefix="/attachments", tags=["attachments"])


def _ensure_attachment_access(att: models.Attachment | None, user: models.User) -> models.Attachment:
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    order = att.order
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # admin — всегда можно
    if user.role == models.Role.admin:
        return att

    # manager/accountant/viewer — можно в пределах своего филиала (если оба филиала указаны)
    if user.role in {models.Role.manager, models.Role.accountant, models.Role.viewer}:
        if user.branch_id and order.branch_id and order.branch_id != user.branch_id:
            raise HTTPException(status_code=403, detail="Branch access denied")
        return att

    # staff — теперь можно для любых заказов (Ташкент/Наманган без ограничений)
    if user.role == models.Role.staff:
        return att

    raise HTTPException(status_code=403, detail="Permission denied")


@router.get("/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    att = db.get(models.Attachment, attachment_id)
    att = _ensure_attachment_access(att, current_user)

    stored_name = os.path.basename(att.filename or "")
    order_id = att.order_id
    if not order_id:
        raise HTTPException(status_code=404, detail="Attachment order missing")

    path = ATTACHMENTS_ROOT / str(order_id) / stored_name
    if not path.exists():
        legacy_path = Path(UPLOAD_DIR) / stored_name
        if legacy_path.exists():
            path = legacy_path
        else:
            raise HTTPException(status_code=404, detail="File missing")

    media_type = att.mime or (mimetypes.guess_type(stored_name)[0] or "application/octet-stream")
    return FileResponse(
        path,
        media_type=media_type,
        filename=att.original_name or stored_name,
    )


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(
        require_roles(models.Role.admin, models.Role.manager, models.Role.staff)
    ),
):
    att = db.get(models.Attachment, attachment_id)
    att = _ensure_attachment_access(att, current_user)

    stored_name = os.path.basename(att.filename or "")
    order_id = att.order_id
    order_dir = ATTACHMENTS_ROOT / str(order_id) if order_id else ATTACHMENTS_ROOT
    path = order_dir / stored_name
    legacy_path = Path(UPLOAD_DIR) / stored_name
    try:
        if path.exists():
            path.unlink()
        if legacy_path.exists():
            legacy_path.unlink()
        if order_id:
            try:
                if order_dir.exists() and not any(order_dir.iterdir()):
                    order_dir.rmdir()
            except OSError:
                pass
    finally:
        log_action(
            db,
            user=current_user,
            action="attachment.delete",
            entity_type="attachment",
            entity_id=attachment_id,
            branch_id=att.order.branch_id if att.order else None,
            extra={"order_id": att.order_id},
        )
        db.delete(att)
        db.commit()
    return None


@router.patch("/{attachment_id}")
def review_attachment(
    attachment_id: int,
    payload: schemas.AttachmentReviewUpdate,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(
        require_roles(models.Role.admin, models.Role.manager, models.Role.accountant)
    ),
):
    att = db.get(models.Attachment, attachment_id)
    att = _ensure_attachment_access(att, current_user)

    try:
        new_status = models.AttachmentStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid attachment status")

    att.status = new_status
    att.review_comment = payload.review_comment
    att.reviewed_at = datetime.utcnow()
    att.reviewed_by_id = current_user.id

    log_action(
        db,
        user=current_user,
        action="attachment.review",
        entity_type="attachment",
        entity_id=att.id,
        branch_id=att.order.branch_id if att.order else None,
        extra={"order_id": att.order_id, "status": new_status.value},
    )

    db.commit()
    db.refresh(att)

    return {
        "id": att.id,
        "status": att.status.value,
        "review_comment": att.review_comment,
        "reviewed_at": att.reviewed_at.isoformat() if att.reviewed_at else None,
    }
