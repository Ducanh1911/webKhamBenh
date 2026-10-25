from datetime import datetime, timedelta, timezone
import bcrypt
from jose import jwt
from app.core.config import settings

# Dùng bcrypt trực tiếp thay cho passlib: passlib 1.7.4 không tương thích
# bcrypt >= 4.1 (lỗi __about__ và giới hạn 72 byte khi khởi tạo backend),
# gây 500 ở POST /auth/register trên Render.

def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False

def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": subject, "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
