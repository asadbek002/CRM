# app/config.py
import os, re
from pathlib import Path

def _get_bool(name: str, default: bool=False) -> bool:
    v = os.getenv(name)
    if v is None: return default
    return v.strip().lower() in {"1","true","yes","y","on"}

def _get_list(name: str, default: str="") -> list[str]:
    raw = os.getenv(name, default)
    if not raw: return []
    return [x.strip() for x in raw.split(",") if x.strip()]

# DB
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")

# Uploads
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

# Max single file size in MB
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "15"))

# Allowed MIME types (env: ALLOWED_MIME="application/pdf,image/png,image/jpeg")
_allowed = _get_list("ALLOWED_MIME", "application/pdf,image/png,image/jpeg")
ALLOWED_MIME: set[str] = set(_allowed)

# Optional: restrict file extensions to match MIME policy
ALLOWED_EXT: set[str] = set(_get_list("ALLOWED_EXT", "pdf,png,jpg,jpeg"))

# Safe filename filter (faqat harf-rakam-.-_ )
SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")

def sanitize_filename(name: str) -> str:
    # katalog ajratgichlarini olib tashlash
    base = name.replace("\\", "/").split("/")[-1]
    # filterni qo‘llash
    clean = SAFE_FILENAME_RE.sub("_", base).strip("._")
    # bo‘sh qolmasin
    return clean or "file"

# JWT
JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_EXPIRE_MINUTES = int(os.getenv("REFRESH_EXPIRE_MINUTES", "43200"))  # 30 kun

# CORS
CORS_ALLOW_ORIGINS = _get_list("CORS_ALLOW_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ALLOW_CREDENTIALS = _get_bool("CORS_ALLOW_CREDENTIALS", True)

# Logs
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Download URL prefix (frontendga kerak bo‘lishi mumkin)
API_PREFIX = os.getenv("API_PREFIX", "/api")

# Fayl soni bo‘yicha cheklov (multi-upload uchun)
MAX_FILES_PER_UPLOAD = int(os.getenv("MAX_FILES_PER_UPLOAD", "10"))
# VERIFY_BASE_URL – verify sahifangizning public URL bazasi
# Lokal test:
# VERIFY_BASE_URL = "http://127.0.0.1:8000/verify"
# Prod (domeningiz bilan):
VERIFY_BASE_URL = os.getenv("VERIFY_BASE_URL", "http://127.0.0.1:8000/verify")

# QR fayllar saqlanadigan papka (backend/qr)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
QR_DIR = os.path.join(os.path.dirname(BASE_DIR), "qr")
os.makedirs(QR_DIR, exist_ok=True)

# qolgan konfiguratsiyalaringiz (DATABASE_URL va hok.)
