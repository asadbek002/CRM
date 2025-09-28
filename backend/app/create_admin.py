# create_admin.py
from app.database import SessionLocal
from app.models import User, Role
from passlib.hash import bcrypt

db = SessionLocal()

admin = User(
    full_name="Admin",
    email="admin@lt.uz",
    phone="1234567890",
    password_hash=bcrypt.hash("admin123"),
    role=Role.admin
)

db.add(admin)
db.commit()
db.close()
print("Admin yaratildi")
