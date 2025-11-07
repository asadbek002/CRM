from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.config import DATABASE_URL
# ВАЖНО: чтобы все модели были импортированы до create_all()
from app.models import Base

# Для SQLite нужен check_same_thread=False
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith(
        "sqlite:///") else {}
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_sqlite_columns():
    """Dev helper that backfills newly introduced columns for SQLite."""

    if not DATABASE_URL.startswith("sqlite:///"):
        return

    def _has_column(conn, table: str, column: str) -> bool:
        rows = conn.execute(text(f"PRAGMA table_info({table});")).fetchall()
        return any(col[1] == column for col in rows)

    with engine.begin() as conn:
        if not _has_column(conn, "attachments", "kind"):
            conn.execute(
                text("ALTER TABLE attachments ADD COLUMN kind TEXT DEFAULT 'other';")
            )

        if not _has_column(conn, "attachments", "status"):
            conn.execute(
                text(
                    "ALTER TABLE attachments ADD COLUMN status TEXT DEFAULT 'pending_review';"
                )
            )

        if not _has_column(conn, "attachments", "reviewed_by_id"):
            conn.execute(text("ALTER TABLE attachments ADD COLUMN reviewed_by_id INTEGER;"))

        if not _has_column(conn, "attachments", "reviewed_at"):
            conn.execute(text("ALTER TABLE attachments ADD COLUMN reviewed_at DATETIME;"))

        if not _has_column(conn, "attachments", "review_comment"):
            conn.execute(text("ALTER TABLE attachments ADD COLUMN review_comment TEXT;"))

        if not _has_column(conn, "users", "is_active"):
            conn.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1;"))

        if not _has_column(conn, "users", "invited_at"):
            conn.execute(text("ALTER TABLE users ADD COLUMN invited_at DATETIME;"))

        if not _has_column(conn, "users", "last_login_at"):
            conn.execute(text("ALTER TABLE users ADD COLUMN last_login_at DATETIME;"))

        if not _has_column(conn, "users", "created_at"):
            conn.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME;"))

        if not _has_column(conn, "users", "updated_at"):
            conn.execute(text("ALTER TABLE users ADD COLUMN updated_at DATETIME;"))

        if not _has_column(conn, "users", "invite_token"):
            conn.execute(text("ALTER TABLE users ADD COLUMN invite_token TEXT;"))

        if not _has_column(conn, "users", "reset_token"):
            conn.execute(text("ALTER TABLE users ADD COLUMN reset_token TEXT;"))

        if not _has_column(conn, "audit_logs", "branch_id"):
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN branch_id INTEGER;"))


def init_db():
    # Создаст таблицы, если их ещё нет (не меняет существующие)
    Base.metadata.create_all(bind=engine)
    # Пропатчит недостающую колонку (dev)
    _ensure_sqlite_columns()


# --- Диагностика при старте ---
try:
    with engine.connect() as conn:
        print("DB URL (effective):", DATABASE_URL)
        try:
            print("PRAGMA database_list:", conn.execute(
                text("PRAGMA database_list;")).all())
        except Exception:
            pass  # не sqlite — ок
        try:
            print("attachments columns (runtime):", conn.execute(
                text("PRAGMA table_info(attachments);")).all())
        except Exception:
            pass
except Exception as e:
    print("DB connection diagnostic failed:", e)
