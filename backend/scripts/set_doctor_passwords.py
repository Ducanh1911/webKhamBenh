"""Đặt lại mật khẩu cho tất cả tài khoản bác sĩ (role DOCTOR).

Cách dùng (không nhập mật khẩu qua chat, không in mật khẩu ra màn hình):
  DATABASE_URL=<chuỗi kết nối> DOCTOR_PASSWORD=<mật khẩu mới> \\
      python scripts/set_doctor_passwords.py

Chỉ in email + số lượng đã đổi, không bao giờ in mật khẩu.
Không đổi role của ai cả — tài khoản có hồ sơ bác sĩ (Doctor row) nhưng
role không phải DOCTOR sẽ được liệt kê riêng để xử lý sau.
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import String, cast, func  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
import app.models  # noqa: E402,F401
from app.core.security import hash_password  # noqa: E402
from app.models.doctor import Doctor  # noqa: E402
from app.models.user import User  # noqa: E402


def main() -> int:
    password = os.environ.get("DOCTOR_PASSWORD", "123456")
    if len(password) < 6:
        print("Loi: DOCTOR_PASSWORD phai tu 6 ky tu tro len.", file=sys.stderr)
        return 1

    db = SessionLocal()
    try:
        # Chẩn đoán: tài khoản có hồ sơ bác sĩ nhưng role không phải DOCTOR.
        linked = db.query(User).join(Doctor, Doctor.user_id == User.id).all()
        odd = [u for u in linked
               if str(u.role).lower().replace("userrole.", "") != "doctor"]
        if odd:
            print("CANH BAO: cac tai khoan co ho so bac si nhung role khong phai DOCTOR "
                  "(chua doi mat khau, chua doi role):")
            for u in odd:
                print(f"  - id={u.id} email={u.email} role={u.role}")

        doctors = (
            db.query(User)
            .filter(func.lower(cast(User.role, String)) == "doctor")
            .order_by(User.id)
            .all()
        )
        if not doctors:
            print("Khong co tai khoan nao role DOCTOR.")
            return 0
        hashed = hash_password(password)
        for u in doctors:
            u.hashed_password = hashed
        db.commit()
        print(f"OK: da doi mat khau cho {len(doctors)} tai khoan bac si:")
        for u in doctors:
            print(f"  - id={u.id} email={u.email} ({u.full_name})")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
