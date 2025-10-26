import os
import re
from pathlib import Path
from typing import List, Set

# Корень backend (на уровень выше app/)
BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _get_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}


def _get_list(name: str, default: str = "") -> List[str]:
    raw = os.getenv(name, default)
    if not raw:
        return []
    return [x.strip() for x in raw.split(",") if x.strip()]


# === DB ===
RAW_DB_URL = os.getenv("DATABASE_URL", "sqlite:///./dev.db")


def _normalize_sqlite_url(raw: str) -> str:
    if raw.startswith("sqlite:///"):
        rel = raw[10:]  # после 'sqlite:///'
        abs_path = (BACKEND_ROOT / rel).resolve()
        return f"sqlite:///{abs_path.as_posix()}"
    return raw


DATABASE_URL = _normalize_sqlite_url(RAW_DB_URL)

# === Uploads ===
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
UPLOAD_DIR = (BACKEND_ROOT / UPLOAD_DIR).resolve().as_posix()
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

# Ограничения и утилиты
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "15"))
_allowed = _get_list("ALLOWED_MIME", "application/pdf,image/png,image/jpeg")
ALLOWED_MIME: Set[str] = set(_allowed)
ALLOWED_EXT:  Set[str] = set(_get_list("ALLOWED_EXT", "pdf,png,jpg,jpeg"))
SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(name: str) -> str:
    base = name.replace("\\", "/").split("/")[-1]
    clean = SAFE_FILENAME_RE.sub("_", base).strip("._")
    return clean or "file"


# JWT
JWT_SECRET = os.getenv("JWT_SECRET", "devsecret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_EXPIRE_MINUTES = int(
    os.getenv("REFRESH_EXPIRE_MINUTES", "43200"))  # 30 дней

# CORS
CORS_ALLOW_ORIGINS = _get_list(
    "CORS_ALLOW_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ALLOW_CREDENTIALS = _get_bool("CORS_ALLOW_CREDENTIALS", True)

# Прочее
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
API_PREFIX = os.getenv("API_PREFIX", "/api")
MAX_FILES_PER_UPLOAD = int(os.getenv("MAX_FILES_PER_UPLOAD", "10"))
VERIFY_BASE_URL = os.getenv("VERIFY_BASE_URL", "http://127.0.0.1:8000/verify")

# Папка для QR
QR_DIR = (BACKEND_ROOT / "qr").resolve()
QR_DIR.mkdir(parents=True, exist_ok=True)
