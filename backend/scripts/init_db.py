"""Tạo bảng lần đầu trên Neon. Chạy 1 lần sau khi có DATABASE_URL:
    python scripts/init_db.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import Base, engine
import app.models  # noqa: F401  (đăng ký models)

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("OK: tables created:", sorted(Base.metadata.tables.keys()))
