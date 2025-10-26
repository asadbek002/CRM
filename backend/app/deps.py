from __future__ import annotations

from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app import models
from app.config import JWT_ALG, JWT_SECRET
from app.database import get_session

_bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_session),
) -> models.User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )

    user = db.get(models.User, int(user_id))
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is inactive or does not exist",
        )

    return user


def require_roles(*allowed: models.Role | str):
    allowed_values: set[str] = {
        role.value if isinstance(role, models.Role) else str(role)
        for role in allowed
    }

    def _dependency(user: models.User = Depends(get_current_user)) -> models.User:
        if allowed_values and user.role.value not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return _dependency


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.Role.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def ensure_branch_scope(
    user: models.User,
    branch_id: int | None,
) -> int | None:
    """Helper used by routers to apply branch-level access restrictions."""

    if not branch_id:
        return branch_id

    if user.role == models.Role.admin:
        return branch_id

    if user.role in {models.Role.manager, models.Role.accountant}:
        if user.branch_id and branch_id != user.branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Branch access denied",
            )
        return branch_id

    # Для остальных ролей доступ к чужому филиалу запрещён
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Branch access denied",
    )


def allowed_for(roles: Iterable[models.Role | str]):
    values = {role.value if isinstance(role, models.Role) else str(role) for role in roles}

    def _predicate(user: models.User) -> bool:
        return user.role.value in values

    return _predicate
