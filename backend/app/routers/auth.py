# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_session, engine
from app import models
from app.utils.security import verify_pw, create_token, hash_pw

# Eslatma: create_all ni aslida startupda chaqirish yaxshiroq,
# lekin hozircha ishlashi uchun qoldirdik.
models.Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/seed")
def seed(db: Session = Depends(get_session)):
    # Filiallar
    if not db.query(models.Branch).first():
        db.add(models.Branch(name="Namangan", city="Namangan"))
        db.add(models.Branch(name="Toshkent", city="Tashkent"))

    # Admin foydalanuvchi
    if not db.query(models.User).first():
        db.add(models.User(
            full_name="Admin",
            phone="+998000000000",
            email="admin@lt.uz",
            password_hash=hash_pw("admin"),
            role=models.Role.admin
        ))

    # Namuna klient
    if not db.query(models.Client).first():
        db.add(models.Client(full_name="Ali Valiyev", phone="+998901234567"))

    db.commit()
    return {"ok": True}


@router.post("/login")
def login(payload: dict, db: Session = Depends(get_session)):
    username = payload.get("username")
    password = payload.get("password", "")

    user = (
        db.query(models.User)
        .filter((models.User.email == username) | (models.User.phone == username))
        .first()
    )

    if not user or not verify_pw(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Noto'g'ri login yoki parol")

    return {
        "access_token": create_token(str(user.id)),
        "user": {
            "id": user.id,
            "name": user.full_name,
            "role": user.role.value,
        },
    }
