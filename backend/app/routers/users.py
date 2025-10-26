from __future__ import annotations

import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_session
from app.deps import ensure_branch_scope, require_admin
from app.services.audit import log_action
from app.utils.security import hash_pw

router = APIRouter(prefix="/users", tags=["users"])


def _serialize_user(user: models.User) -> schemas.UserOut:
    return schemas.UserOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role=user.role.value,
        branch_id=user.branch_id,
        branch_name=user.branch.name if user.branch else None,
        is_active=bool(user.is_active),
        invited_at=user.invited_at,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
    )


@router.get("")
def list_users(
    q: Optional[str] = None,
    role: Optional[str] = None,
    branch_id: Optional[int] = None,
    include_inactive: bool = False,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(require_admin),
):
    qs = db.query(models.User).outerjoin(models.Branch)

    if q:
        like = f"%{q}%"
        qs = qs.filter(
            (models.User.full_name.ilike(like))
            | (models.User.email.ilike(like))
            | (models.User.phone.ilike(like))
        )

    if role:
        try:
            role_enum = models.Role(role)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role value")
        qs = qs.filter(models.User.role == role_enum)

    if branch_id:
        branch_id = ensure_branch_scope(current_user, branch_id)
        qs = qs.filter(models.User.branch_id == branch_id)

    if not include_inactive:
        qs = qs.filter(models.User.is_active.is_(True))

    users = qs.order_by(models.User.full_name.asc()).all()
    return [_serialize_user(u) for u in users]


@router.post("", response_model=schemas.UserOut, status_code=201)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(require_admin),
):
    try:
        role = models.Role(payload.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role value")

    user = models.User(
        full_name=payload.full_name.strip(),
        email=payload.email.strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        role=role,
        branch_id=payload.branch_id,
        is_active=True,
    )

    if payload.password:
        user.password_hash = hash_pw(payload.password)
    else:
        random_password = secrets.token_urlsafe(8)
        user.password_hash = hash_pw(random_password)

    db.add(user)
    db.flush()

    log_action(
        db,
        user=current_user,
        action="user.create",
        entity_type="user",
        entity_id=user.id,
        branch_id=user.branch_id,
        extra={"role": role.value},
    )

    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(require_admin),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.email is not None:
        user.email = payload.email.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip()
    if payload.role is not None:
        try:
            user.role = models.Role(payload.role)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid role value")
    if payload.branch_id is not None:
        user.branch_id = payload.branch_id
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.password:
        user.password_hash = hash_pw(payload.password)
        user.reset_token = None
        user.invite_token = None

    log_action(
        db,
        user=current_user,
        action="user.update",
        entity_type="user",
        entity_id=user.id,
        branch_id=user.branch_id,
    )

    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.delete("/{user_id}", status_code=204)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(require_admin),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    log_action(
        db,
        user=current_user,
        action="user.deactivate",
        entity_type="user",
        entity_id=user.id,
        branch_id=user.branch_id,
    )
    db.commit()
    return None


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: int,
    payload: schemas.PasswordResetIn,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(require_admin),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_pw(payload.password)
    user.reset_token = None
    user.invite_token = None
    log_action(
        db,
        user=current_user,
        action="user.reset_password",
        entity_type="user",
        entity_id=user.id,
        branch_id=user.branch_id,
    )
    db.commit()
    return {"ok": True}


@router.post("/{user_id}/invite")
def invite_user(
    user_id: int,
    db: Session = Depends(get_session),
    current_user: models.User = Depends(require_admin),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token = secrets.token_urlsafe(24)
    user.invite_token = token
    user.invited_at = datetime.utcnow()
    log_action(
        db,
        user=current_user,
        action="user.invite",
        entity_type="user",
        entity_id=user.id,
        branch_id=user.branch_id,
    )
    db.commit()
    return {"invite_token": token}
*** End of File
