# app/routers/comments.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_session
from app.deps import get_current_user, require_roles
from app.services.audit import log_action
from app.services import notifications as notification_service

router = APIRouter(prefix="/orders/{order_id}/comments", tags=["comments"])


def _ensure_comment_scope(db: Session, order_id: int, user: models.User) -> models.Order:
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # admin — всегда можно
    if user.role == models.Role.admin:
        return order

    # manager/accountant/viewer — можно в пределах своего филиала (если оба филиала указаны)
    if user.role in {models.Role.manager, models.Role.accountant, models.Role.viewer}:
        if user.branch_id and order.branch_id and order.branch_id != user.branch_id:
            raise HTTPException(status_code=403, detail="Branch access denied")
        return order

    # staff — теперь можно для любых заказов (Ташкент/Наманган без ограничений)
    if user.role == models.Role.staff:
        return order

    raise HTTPException(status_code=403, detail="Permission denied")


@router.get("", response_model=list[schemas.CommentOut])
def list_comments(
    order_id: int,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_comment_scope(db, order_id, current_user)
    return (
        db.query(models.Comment)
        .filter(models.Comment.order_id == order_id)
        .order_by(models.Comment.id.desc())
        .all()
    )


@router.post("", response_model=schemas.CommentOut)
def add_comment(
    order_id: int,
    payload: schemas.CommentCreate,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(
        require_roles(models.Role.admin, models.Role.manager, models.Role.staff)
    ),
):
    order = _ensure_comment_scope(db, order_id, current_user)
    c = models.Comment(
        order_id=order_id,
        text=payload.text.strip(),
        author=payload.author or current_user.full_name,
    )
    db.add(c)
    db.flush()

    notif: models.Notification | None = None
    if order.manager_id:
        author_name = c.author or current_user.full_name
        message = f"New comment on order #{order.id} by {author_name}"
        payload = {
            "order_id": order.id,
            "comment_id": c.id,
            "author": author_name,
        }
        notif = notification_service.create_notification(
            db,
            user_id=order.manager_id,
            kind=models.NotificationKind.comment_added,
            message=message,
            order_id=order.id,
            payload=payload,
        )
    log_action(
        db,
        user=current_user,
        action="comment.create",
        entity_type="comment",
        entity_id=c.id,
        branch_id=order.branch_id,
        extra={"order_id": order.id},
    )
    db.commit()
    db.refresh(c)

    if notif:
        db.refresh(notif)
        notification_service.queue_delivery(notif)
    return c


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    order_id: int,
    comment_id: int,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(
        require_roles(models.Role.admin, models.Role.manager)
    ),
):
    order = _ensure_comment_scope(db, order_id, current_user)
    c = db.get(models.Comment, comment_id)
    if not c or c.order_id != order_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(c)
    log_action(
        db,
        user=current_user,
        action="comment.delete",
        entity_type="comment",
        entity_id=comment_id,
        branch_id=order.branch_id,
        extra={"order_id": order_id},
    )
    db.commit()
