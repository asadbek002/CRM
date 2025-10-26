from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app import models


def log_action(
    db: Session,
    *,
    user: models.User | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: str | None = None,
    extra: dict[str, Any] | None = None,
    branch_id: int | None = None,
) -> None:
    """Persist a row in the audit log."""

    payload = details
    if extra:
        serialized = {**extra}
        if details:
            serialized["message"] = details
        payload = json_dumps(serialized)

    if branch_id is None and isinstance(user, models.User):
        branch_id = user.branch_id

    entry = models.AuditLog(
        user_id=user.id if isinstance(user, models.User) else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=payload,
        branch_id=branch_id,
    )
    db.add(entry)


def json_dumps(data: dict[str, Any]) -> str:
    try:
        import json

        return json.dumps(data, ensure_ascii=False)
    except Exception:  # pragma: no cover - defensive fallback
        return str(data)
