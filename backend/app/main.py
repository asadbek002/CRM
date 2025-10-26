# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os

from app.database import engine
from app import models
from app.database import init_db
from app.routers import comments

# config – mavjud bo‘lmasa ham ishlashi uchun fallbacklar qo‘yamiz
try:
    from app.config import (
        UPLOAD_DIR,
        QR_DIR,
        CORS_ALLOW_ORIGINS,
        CORS_ALLOW_CREDENTIALS,
    )
except Exception:
    UPLOAD_DIR = "./uploads"
    QR_DIR = "./qr"
    CORS_ALLOW_ORIGINS = None
    CORS_ALLOW_CREDENTIALS = True

# routerlar
from app.routers import auth, clients, orders, payments, attachments, users, dashboard
# verify router ichida prefix bo‘lsa, shu holatda qoladi
from app.routers.verify import router as verify_router

app = FastAPI(title="Lingua CRM API", version="1.0.0")

# CORS
default_allowed = ["http://localhost:5173", "http://127.0.0.1:5173"]
allowed_origins = CORS_ALLOW_ORIGINS or default_allowed
allow_credentials = True if CORS_ALLOW_CREDENTIALS is None else bool(
    CORS_ALLOW_CREDENTIALS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=allow_credentials,
)

# DB jadvallarini yaratish (agar yo‘q bo‘lsa)
models.Base.metadata.create_all(bind=engine)
init_db()  # ← добавь эту строку


# Routerlarni ulash
app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(orders.router)
app.include_router(payments.router)
app.include_router(attachments.router)
app.include_router(comments.router)
app.include_router(users.router)
app.include_router(dashboard.router)
# verify_router ichida APIRouter(prefix="/verify") bo‘lishi kutiladi
app.include_router(verify_router)

# Statik fayllar (katalog mavjud bo‘lsa ulaymiz)
if os.path.isdir(UPLOAD_DIR):
    app.mount("/files", StaticFiles(directory=UPLOAD_DIR), name="files")

if os.path.isdir(QR_DIR):
    app.mount("/qr", StaticFiles(directory=QR_DIR), name="qr")

# Root -> /docs


@app.get("/")
def root():
    return RedirectResponse(url="/docs")

# Sog‘lomlik tekshiruvi


@app.get("/health")
def health():
    return {"ok": True}
