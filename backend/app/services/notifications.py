"""Notification delivery helpers and background workers."""
from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from datetime import date, datetime
from typing import Any, Dict, Optional, Set

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import SessionLocal


class NotificationBroker:
    """In-memory fan-out for per-user notification queues."""

    def __init__(self) -> None:
        self._subscribers: dict[int, Set[asyncio.Queue]] = defaultdict(set)
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def subscribe(self, user_id: int) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._subscribers.setdefault(user_id, set()).add(queue)
        return queue

    async def unsubscribe(self, user_id: int, queue: asyncio.Queue) -> None:
        async with self._lock:
            queues = self._subscribers.get(user_id)
            if not queues:
                return
            queues.discard(queue)
            if not queues:
                self._subscribers.pop(user_id, None)

    async def _publish(self, user_id: int, payload: dict[str, Any]) -> None:
        async with self._lock:
            queues = list(self._subscribers.get(user_id, ()))
        for queue in queues:
            await queue.put(payload)

    def publish(self, user_id: int, payload: dict[str, Any]) -> None:
        if not self._loop:
            return
        try:
            current = asyncio.get_running_loop()
        except RuntimeError:
            current = None

        if current is self._loop:
            self._loop.create_task(self._publish(user_id, payload))
        else:
            asyncio.run_coroutine_threadsafe(self._publish(user_id, payload), self._loop)


_broker = NotificationBroker()
_shutdown_event = asyncio.Event()
_deadline_task: asyncio.Task | None = None


def _decode_payload(raw: Optional[str]) -> Optional[dict[str, Any]]:
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def notification_to_schema(notification: models.Notification) -> schemas.NotificationOut:
    payload = _decode_payload(notification.payload)
    created_at = notification.created_at or datetime.utcnow()
    return schemas.NotificationOut(
        id=notification.id,
        user_id=notification.user_id,
        order_id=notification.order_id,
        kind=schemas.NotificationKind(notification.kind.value),
        message=notification.message,
        payload=payload,
        is_read=notification.is_read,
        created_at=created_at,
        read_at=notification.read_at,
    )


def queue_delivery(notification: models.Notification) -> None:
    payload = notification_to_schema(notification).model_dump(mode="json")
    _broker.publish(notification.user_id, payload)


def create_notification(
    db: Session,
    *,
    user_id: int,
    kind: models.NotificationKind,
    message: str,
    order_id: int | None = None,
    payload: Optional[Dict[str, Any]] = None,
) -> models.Notification:
    now = datetime.utcnow()
    notif = models.Notification(
        user_id=user_id,
        order_id=order_id,
        kind=kind,
        message=message,
        payload=json.dumps(payload) if payload else None,
        created_at=now,
    )
    db.add(notif)
    db.flush()
    return notif


async def subscribe(user_id: int) -> asyncio.Queue:
    return await _broker.subscribe(user_id)


async def unsubscribe(user_id: int, queue: asyncio.Queue) -> None:
    await _broker.unsubscribe(user_id, queue)


async def startup_notifications() -> None:
    loop = asyncio.get_running_loop()
    _broker.set_loop(loop)
    _shutdown_event.clear()
    global _deadline_task
    if _deadline_task is None or _deadline_task.done():
        _deadline_task = asyncio.create_task(_deadline_loop())


async def shutdown_notifications() -> None:
    _shutdown_event.set()
    if _deadline_task:
        await _deadline_task


async def _deadline_loop() -> None:
    # initial small delay so app can finish startup
    try:
        await asyncio.wait_for(_shutdown_event.wait(), timeout=5)
        return
    except asyncio.TimeoutError:
        pass

    while not _shutdown_event.is_set():
        await asyncio.to_thread(_process_deadlines)
        try:
            await asyncio.wait_for(_shutdown_event.wait(), timeout=300)
        except asyncio.TimeoutError:
            continue


def _process_deadlines() -> None:
    session = SessionLocal()
    try:
        today = date.today()
        orders = (
            session.query(models.Order)
            .filter(
                models.Order.deleted_at.is_(None),
                models.Order.manager_id.isnot(None),
                models.Order.deadline.isnot(None),
                models.Order.deadline <= today,
            )
            .all()
        )

        if not orders:
            return

        new_notifications: list[models.Notification] = []
        for order in orders:
            manager_id = order.manager_id
            if not manager_id:
                continue

            exists = (
                session.query(models.Notification)
                .filter(
                    models.Notification.user_id == manager_id,
                    models.Notification.kind == models.NotificationKind.deadline_due,
                    models.Notification.order_id == order.id,
                    func.date(models.Notification.created_at) == today,
                )
                .first()
            )
            if exists:
                continue

            client_name = order.client.full_name if order.client else ""
            message = (
                f"Order #{order.id} deadline is due"
                + (f" for {client_name}" if client_name else "")
            )
            payload = {
                "order_id": order.id,
                "deadline": order.deadline.isoformat() if order.deadline else None,
            }
            notif = create_notification(
                session,
                user_id=manager_id,
                kind=models.NotificationKind.deadline_due,
                message=message,
                order_id=order.id,
                payload=payload,
            )
            new_notifications.append(notif)

        if not new_notifications:
            session.rollback()
            return

        session.commit()
        for notif in new_notifications:
            session.refresh(notif)
            queue_delivery(notif)
    except Exception as exc:  # pragma: no cover - best effort logging
        session.rollback()
        print("Deadline notification error", exc)
    finally:
        session.close()
