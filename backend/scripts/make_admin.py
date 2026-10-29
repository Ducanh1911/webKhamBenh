"""Tạo hoặc nâng cấp tài khoản quản trị.

Cách dùng (không nhập mật khẩu qua chat, không in mật khẩu ra màn hình):
  # Nâng cấp tài khoản đã có sẵn (khuyến nghị, không cần mật khẩu):
  python scripts/make_admin.py --email anh@example.com

  # Tạo mới (mật khẩu lấy từ biến môi trường, không truyền qua chat):
  ADMIN_PASSWORD='...' python scripts/make_admin.py --email admin@example.com --full-name "Quan tri vien"

Chạy với DATABASE_URL trỏ tới DB cần tạo admin (local hoặc Neon).
Script chỉ in email + role, không bao giờ in mật khẩu.
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import SessionLocal, Base, engine  # noqa: E402
import app.models  # noqa: E402,F401
from app.core.security import hash_password  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Tao / nang cap tai khoan admin")
    parser.add_argument("--email", required=True)
    parser.add_argument("--full-name", default="Quan tri vien")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email).first()
        if user:
            user.role = UserRole.ADMIN
            db.commit()
            print(f"OK: da nang cap {user.email} len role admin (id={user.id})")
            return 0
        password = os.environ.get("ADMIN_PASSWORD")
        if not password or len(password) < 8:
            print(
                "Loi: tai khoan chua co. Hay dat bien moi truong ADMIN_PASSWORD "
                "(toi thieu 8 ky tu) roi chay lai, hoac dang ky tai khoan truoc "
                "roi chay script nay de nang cap.",
                file=sys.stderr,
            )
            return 1
        user = User(
            full_name=args.full_name,
            email=args.email,
            phone=None,
            hashed_password=hash_password(password),
            role=UserRole.ADMIN,
        )
        db.add(user)
        db.commit()
        print(f"OK: da tao tai khoan admin {user.email} (id={user.id})")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
