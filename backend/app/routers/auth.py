from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app import models
from app.database import engine, get_session
from app.utils.security import create_token, hash_pw, verify_pw

models.Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: dict, response: Response, db: Session = Depends(get_session)):
    username = payload.get("username")
    password = payload.get("password", "")

    user = (
        db.query(models.User)
        .filter((models.User.email == username) | (models.User.phone == username))
        .first()
    )
    if not user or not verify_pw(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Noto'g'ri login yoki parol")

    user.last_login_at = datetime.utcnow()
    db.add(user); db.commit(); db.refresh(user)

    token = create_token(str(user.id))

    # ¡ç ¬Ó¬à¬ä ¬ï¬ä¬à ¬°¬¢¬Á¬©¬¡¬´¬¦¬­¬¾¬¯¬° ¬Õ¬à¬Ý¬Ø¬ß¬à ¬Ò¬í¬ä¬î
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",   # ¬Ó ¬á¬â¬à¬Õ¬Ö: 'none' + secure=True, ¬Ö¬ã¬Ý¬Ú ¬æ¬â¬à¬ß¬ä ¬ß¬Ñ ¬Õ¬â¬å¬Ô¬à¬Þ ¬Õ¬à¬Þ¬Ö¬ß¬Ö ¬Ú https
        secure=False,
        max_age=60*60*24,
        path="/",
    )

    return {
        "access_token": token,
        "user": {"id": user.id, "name": user.full_name, "role": user.role.value, "branch_id": user.branch_id},
    }

