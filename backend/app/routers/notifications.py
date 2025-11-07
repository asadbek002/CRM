from __future__ import annotations

import asyncio
import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import API_PREFIX
from app.database import get_session
from app.deps import get_current_user
from app.services import notifications as notification_service

router = APIRouter(prefix=f"{API_PREFIX}/notifications", tags=["notifications"])


@router.get("", response_model=list[schemas.NotificationOut])
def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    rows = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.id.desc())
        .limit(limit)
        .all()
    )
    return [notification_service.notification_to_schema(row) for row in rows]


@router.post("/mark-read", response_model=schemas.NotificationsMarkReadResponse)
def mark_all_read(
    db: Session = Depends(get_session),
    current_user: models.User = Depends(get_current_user),
):
    now = datetime.utcnow()
    updated = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read.is_(False),
        )
        .update(
            {
                models.Notification.is_read: True,
                models.Notification.read_at: now,
            },
            synchronize_session=False,
        )
    )
    db.commit()
    return schemas.NotificationsMarkReadResponse(updated=updated or 0)


@router.get("/stream")
async def notifications_stream(
    request: Request,
    current_user: models.User = Depends(get_current_user),
):
    queue = await notification_service.subscribe(current_user.id)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=30)
                except asyncio.TimeoutError:
                    yield "event: ping\ndata: {}\n\n"
                    continue

                data = json.dumps(payload)
                yield f"event: notification\ndata: {data}\n\n"
        finally:
            await notification_service.unsubscribe(current_user.id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
