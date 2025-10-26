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
    """
    Dev-хелпер: если в SQLite нет колонки attachments.kind — добавим.
    Безопасно для пустой/небольшой dev-базы. В проде делайте Alembic.
    """
    if not DATABASE_URL.startswith("sqlite:///"):
        return
    with engine.begin() as conn:
        cols = conn.execute(text("PRAGMA table_info(attachments);")).fetchall()
        have_kind = any((c[1] == "kind") for c in cols)  # c[1] = name
        if not have_kind:
            # добавляем с DEFAULT, т.к. SQLite не любит NOT NULL без дефолта
            conn.execute(
                text("ALTER TABLE attachments ADD COLUMN kind TEXT DEFAULT 'other';"))


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
