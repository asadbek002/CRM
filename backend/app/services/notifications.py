"""Notification delivery helpers (DB + SSE broker)."""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from contextlib import suppress
from datetime import date, datetime
from typing import Any, AsyncIterator, Sequence

import anyio
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app import models
from app.database import SessionLocal

logger = logging.getLogger(__name__)


class _NotificationBroker:
    """In-memory fan-out of notification events to SSE subscribers."""

    def __init__(self) -> None:
        self._subscribers: dict[int, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def register(self, user_id: int) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        async with self._lock:
            self._subscribers[user_id].add(queue)
        return queue

    async def unregister(self, user_id: int, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            queues = self._subscribers.get(user_id)
            if not queues:
                return
            queues.discard(queue)
            if not queues:
                self._subscribers.pop(user_id, None)

    async def publish(self, user_id: int, payload: dict[str, Any]) -> None:
        async with self._lock:
            queues = list(self._subscribers.get(user_id, set()))
        if not queues:
            return
        for queue in queues:
            await queue.put(payload)


_broker = _NotificationBroker()


def _json_load(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        logger.warning("Cannot decode notification payload: %s", raw)
        return {}


def serialize_notification(notification: models.Notification) -> dict[str, Any]:
    return {
        "id": notification.id,
        "type": notification.type,
        "title": notification.title,
        "message": notification.message,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
        "is_read": bool(notification.is_read),
        "order_id": notification.order_id,
        "data": _json_load(notification.payload),
    }


def queue_notification(
    db: Session,
    *,
    user_id: int,
    notif_type: models.NotificationType | str,
    title: str,
    message: str | None = None,
    order: models.Order | None = None,
    payload: dict[str, Any] | None = None,
    dedupe_date: date | None = None,
) -> models.Notification:
    notification = models.Notification(
        user_id=user_id,
        type=notif_type.value if isinstance(notif_type, models.NotificationType) else str(notif_type),
        title=title,
        message=message,
        order_id=order.id if order else None,
        payload=json.dumps(payload or {}, ensure_ascii=False),
        dedupe_date=dedupe_date,
    )
    db.add(notification)
    db.flush()
    return notification


def dispatch_notifications(db: Session, notifications: Sequence[models.Notification]) -> None:
    for notification in notifications:
        try:
            db.refresh(notification)
        except Exception:  # pragma: no cover - defensive: session may be closed
            continue
        payload = serialize_notification(notification)
        _publish_to_stream(notification.user_id, payload)


def _publish_to_stream(user_id: int, payload: dict[str, Any]) -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # Running inside sync endpoint (threadpool)
        anyio.from_thread.run(_broker.publish, user_id, payload)
    else:
        loop.create_task(_broker.publish(user_id, payload))


async def stream_events(user_id: int) -> AsyncIterator[dict[str, Any]]:
    queue = await _broker.register(user_id)
    try:
        while True:
            try:
                payload = await asyncio.wait_for(queue.get(), timeout=25)
                yield {"event": "notification", "data": json.dumps(payload)}
            except asyncio.TimeoutError:
                # Keep connection alive
                yield {
                    "event": "heartbeat",
                    "data": json.dumps({"ts": datetime.utcnow().isoformat()}),
                }
    finally:
        await _broker.unregister(user_id, queue)


async def run_deadline_check(today: date | None = None) -> None:
    """Creates deadline notifications once per day for due orders."""

    today = today or date.today()
    with SessionLocal() as db:
        due_orders = (
            db.query(models.Order)
            .filter(models.Order.deadline.isnot(None))
            .filter(models.Order.manager_id.isnot(None))
            .filter(models.Order.deadline <= today)
            .all()
        )

        pending: list[models.Notification] = []
        for order in due_orders:
            manager_id = order.manager_id
            if not manager_id:
                continue

            already_sent = (
                db.query(models.Notification)
                .filter(
                    and_(
                        models.Notification.user_id == manager_id,
                        models.Notification.type == models.NotificationType.deadline_due.value,
                        models.Notification.order_id == order.id,
                        models.Notification.dedupe_date == today,
                    )
                )
                .first()
            )
            if already_sent:
                continue

            payload = {
                "order_id": order.id,
                "deadline": order.deadline.isoformat() if order.deadline else None,
            }
            if order.client:
                payload["client_name"] = order.client.full_name

            if order.deadline:
                message = (
                    f"Buyurtma #{order.id} uchun muddat {order.deadline.isoformat()} kuni."
                )
            else:
                message = f"Buyurtma #{order.id} uchun muddat tugagan."

            pending.append(
                queue_notification(
                    db,
                    user_id=manager_id,
                    notif_type=models.NotificationType.deadline_due,
                    title="Buyurtma muddati tugamoqda",
                    message=message,
                    order=order,
                    payload=payload,
                    dedupe_date=today,
                )
            )

        if not pending:
            db.rollback()
            return

        try:
            db.commit()
        except Exception:  # pragma: no cover - log and move on
            db.rollback()
            logger.exception("Failed to commit deadline notifications")
            return

        dispatch_notifications(db, pending)


_deadline_task: asyncio.Task[None] | None = None


async def start_deadline_notifier() -> None:
    global _deadline_task
    if _deadline_task and not _deadline_task.done():
        return

    async def _worker() -> None:
        while True:
            try:
                await run_deadline_check()
            except Exception:  # pragma: no cover - keep the loop alive
                logger.exception("Deadline notifier iteration failed")
            await asyncio.sleep(300)

    loop = asyncio.get_running_loop()
    _deadline_task = loop.create_task(_worker())


async def stop_deadline_notifier() -> None:
    global _deadline_task
    if not _deadline_task:
        return
    _deadline_task.cancel()
    with suppress(asyncio.CancelledError):
        await _deadline_task
    _deadline_task = None


def unread_count(db: Session, user_id: int) -> int:
    return (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == user_id,
            models.Notification.is_read.is_(False),
        )
        .count()
    )


def notification_list(db: Session, user_id: int, limit: int = 50) -> list[dict[str, Any]]:
    items = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user_id)
        .order_by(models.Notification.id.desc())
        .limit(limit)
        .all()
    )
    return [serialize_notification(item) for item in items]

