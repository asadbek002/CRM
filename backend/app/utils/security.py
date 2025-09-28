from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from app.config import JWT_SECRET, JWT_ALG
pwd=CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_pw(p): return pwd.hash(p)
def verify_pw(p,h): return pwd.verify(p,h)
def create_token(sub:str, minutes=60*8): return jwt.encode({"sub":sub,"exp":datetime.utcnow()+timedelta(minutes=minutes)}, JWT_SECRET, algorithm=JWT_ALG)
