"""Notification endpoints (list, mark read, SSE stream)."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from starlette.responses import EventSourceResponse

from app import models, schemas
from app.config import API_PREFIX
from app.database import get_session
from app.deps import get_current_user
from app.services import notifications as notification_service


router = APIRouter(prefix=f"{API_PREFIX}/notifications", tags=["notifications"])


@router.get("", response_model=schemas.NotificationListOut)
def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    items = notification_service.notification_list(db, current_user.id, limit)
    unread = notification_service.unread_count(db, current_user.id)
    return {"items": items, "unread": unread}


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    updated = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read.is_(False),
        )
        .update(
            {
                models.Notification.is_read: True,
                models.Notification.read_at: datetime.utcnow(),
            },
            synchronize_session=False,
        )
    )
    db.commit()
    return {"updated": int(updated or 0), "unread": 0}


@router.get("/stream")
async def notification_stream(
    current_user: models.User = Depends(get_current_user),
):
    async def event_generator():
        async for event in notification_service.stream_events(current_user.id):
            yield event

    return EventSourceResponse(event_generator())

