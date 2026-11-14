# -*- coding: utf-8 -*-
"""Test ad-hoc cho 3 tính năng mới: đổi mật khẩu + API bác sĩ + quên mật khẩu.

Chạy:  ~/workspace/.venv-momo-test/bin/python backend/test_new_features.py
Dùng FastAPI TestClient + SQLite tạm (không đụng DB thật): DATABASE_URL
được ghi đè sang file tạm TRƯỚC khi import app, và get_db được override.
Xóa file DB tạm sau khi chạy xong.
"""
import os
import sys
import tempfile
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["SECRET_KEY"] = "test-secret-key"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.database import Base, get_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.appointment import Appointment, AppointmentStatus  # noqa: E402
from app.models.doctor import Doctor, Specialty  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

ICT = ZoneInfo("Asia/Ho_Chi_Minh")

engine = create_engine(os.environ["DATABASE_URL"])
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


def _override_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_db
client = TestClient(app)

# ---------------- seed ----------------
db = TestingSession()
spec1 = Specialty(name="Nội tổng quát", description="Khám tổng quát")
spec2 = Specialty(name="Tim mạch", description="Khám tim mạch")
db.add_all([spec1, spec2])
db.flush()

PW = "matkhau1"


def mkuser(name, email, role, phone=None):
    u = User(full_name=name, email=email, phone=phone,
             hashed_password=hash_password(PW), role=role)
    db.add(u)
    db.flush()
    return u


patient1 = mkuser("Bệnh nhân Một", "bn1@test.vn", UserRole.PATIENT, "0900000001")
patient2 = mkuser("Bệnh nhân Hai", "bn2@test.vn", UserRole.PATIENT, "0900000002")
doc_user1 = mkuser("BS. Nguyễn Văn An", "bs1@test.vn", UserRole.DOCTOR, "0900000011")
doc_user2 = mkuser("BS. Trần Thị Bình", "bs2@test.vn", UserRole.DOCTOR, "0900000012")
doc_noprofile = mkuser("BS. Chưa Có Hồ Sơ", "bs3@test.vn", UserRole.DOCTOR)
admin1 = mkuser("Quản trị", "admin@test.vn", UserRole.ADMIN)

doc1 = Doctor(user_id=doc_user1.id, specialty_id=spec1.id, clinic_name="Phòng khám A",
              years_experience=10, consultation_fee=200000, bio="Bác sĩ nhiều kinh nghiệm")
doc2 = Doctor(user_id=doc_user2.id, specialty_id=spec2.id, clinic_name="Phòng khám B",
              years_experience=5, consultation_fee=300000, bio=None)
db.add_all([doc1, doc2])
db.flush()

today = datetime.now(ICT).date()


def at(day_offset, hour, minute=0):
    return datetime.combine(today + timedelta(days=day_offset), time(hour, minute), tzinfo=ICT)


def mkappt(patient, doctor, start, status, reason="Đau đầu"):
    a = Appointment(patient_id=patient.id, doctor_id=doctor.id,
                    start_at=start, reason=reason, status=status)
    db.add(a)
    db.flush()
    return a


# Lịch của bác sĩ 1: tổng 7, chờ 3, đã xác nhận 1, hôm nay 3.
a1 = mkappt(patient1, doc1, at(0, 9), AppointmentStatus.PENDING)
a2 = mkappt(patient2, doc1, at(0, 10), AppointmentStatus.CONFIRMED)
a3 = mkappt(patient1, doc1, at(1, 9), AppointmentStatus.PENDING)
a4 = mkappt(patient1, doc1, at(-1, 9), AppointmentStatus.CANCELLED)
a5 = mkappt(patient2, doc1, at(1, 11), AppointmentStatus.COMPLETED)
a6 = mkappt(patient1, doc1, at(0, 14), AppointmentStatus.NO_SHOW)
a7 = mkappt(patient1, doc1, at(1, 13), AppointmentStatus.PENDING)
# Lịch của bác sĩ 2: tổng 2.
b1 = mkappt(patient1, doc2, at(0, 9), AppointmentStatus.PENDING)
b2 = mkappt(patient2, doc2, at(1, 10), AppointmentStatus.CONFIRMED)
db.commit()
# Lưu id trước khi đóng session (object ORM sẽ bị detach, không đọc được thuộc tính nữa).
A1, A2, A3, A4, A5, A6, A7 = a1.id, a2.id, a3.id, a4.id, a5.id, a6.id, a7.id
B1, B2 = b1.id, b2.id
db.close()

# ---------------- helpers ----------------
passed = failed = 0
failures = []


def check(name, cond, extra=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  PASS {name}")
    else:
        failed += 1
        failures.append(name)
        print(f"  FAIL {name} {extra}")


def login(email, password):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


H_P1 = login("bn1@test.vn", PW)
H_P2 = login("bn2@test.vn", PW)
H_D1 = login("bs1@test.vn", PW)
H_D2 = login("bs2@test.vn", PW)
H_D3 = login("bs3@test.vn", PW)
H_ADMIN = login("admin@test.vn", PW)

print("== Đổi mật khẩu ==")
r = client.post("/api/v1/auth/change-password",
                json={"current_password": PW, "new_password": "matkhauMoi1"})
check("chưa đăng nhập -> 401", r.status_code == 401, r.text[:200])

r = client.post("/api/v1/auth/change-password", headers=H_P1,
                json={"current_password": "sai-hoan-toan", "new_password": "matkhauMoi1"})
check("sai mật khẩu hiện tại -> 400 + đúng thông báo",
      r.status_code == 400 and r.json().get("detail") == "Mật khẩu hiện tại không đúng", r.text[:200])

r = client.post("/api/v1/auth/change-password", headers=H_P1,
                json={"current_password": PW, "new_password": "12345"})
check("mật khẩu mới < 6 ký tự -> 400", r.status_code == 400, r.text[:200])

r = client.post("/api/v1/auth/change-password", headers=H_P1,
                json={"current_password": PW, "new_password": PW})
check("mật khẩu mới trùng mật khẩu cũ -> 400 + đúng thông báo",
      r.status_code == 400 and r.json().get("detail") == "Mật khẩu mới phải khác mật khẩu hiện tại", r.text[:200])

r = client.post("/api/v1/auth/change-password", headers=H_P1,
                json={"current_password": PW, "new_password": "matkhauMoi1"})
check("đổi mật khẩu thành công -> 200 + đúng thông báo",
      r.status_code == 200 and r.json().get("message") == "Đổi mật khẩu thành công", r.text[:200])

r = client.post("/api/v1/auth/login", json={"email": "bn1@test.vn", "password": "matkhauMoi1"})
check("đăng nhập được bằng mật khẩu mới", r.status_code == 200, r.text[:200])
r = client.post("/api/v1/auth/login", json={"email": "bn1@test.vn", "password": PW})
check("mật khẩu cũ không đăng nhập được nữa", r.status_code == 401, r.text[:200])

r = client.post("/api/v1/auth/change-password", headers=H_ADMIN,
                json={"current_password": PW, "new_password": "adminMoi1"})
check("admin cũng đổi được mật khẩu", r.status_code == 200, r.text[:200])

print("== Doctor API: quyền truy cập ==")
r = client.get("/api/v1/doctor/me", headers=H_P2)
check("bệnh nhân GET /doctor/me -> 403",
      r.status_code == 403 and r.json().get("detail") == "Cần quyền bác sĩ", r.text[:200])
r = client.get("/api/v1/doctor/me", headers=H_ADMIN)
check("admin GET /doctor/me -> 403", r.status_code == 403, r.text[:200])
r = client.get("/api/v1/doctor/me")
check("chưa đăng nhập GET /doctor/me -> 401", r.status_code == 401, r.text[:200])
r = client.get("/api/v1/doctor/me", headers=H_D3)
check("bác sĩ chưa có hồ sơ -> 404 + đúng thông báo",
      r.status_code == 404 and r.json().get("detail") == "Tài khoản bác sĩ chưa có hồ sơ", r.text[:200])
r = client.get("/api/v1/doctor/appointments", headers=H_P2)
check("bệnh nhân GET /doctor/appointments -> 403", r.status_code == 403, r.text[:200])
r = client.get("/api/v1/doctor/appointments", headers=H_D3)
check("bác sĩ chưa có hồ sơ GET /doctor/appointments -> 404", r.status_code == 404, r.text[:200])

print("== Doctor API: GET /me + danh sách lịch ==")
r = client.get("/api/v1/doctor/me", headers=H_D1)
d = r.json()
check("GET /me bác sĩ 1 -> 200 + đúng hồ sơ",
      r.status_code == 200 and d["full_name"] == "BS. Nguyễn Văn An"
      and d["specialty_name"] == "Nội tổng quát" and d["clinic_name"] == "Phòng khám A"
      and d["years_experience"] == 10 and d["consultation_fee"] == 200000
      and d["bio"] == "Bác sĩ nhiều kinh nghiệm" and d["email"] == "bs1@test.vn", r.text[:300])
check("GET /me thống kê đúng (tổng 7, chờ 3, đã xác nhận 1, hôm nay 3)",
      d["total_appointments"] == 7 and d["pending_appointments"] == 3
      and d["confirmed_appointments"] == 1 and d["today_appointments"] == 3, str(d))
r = client.get("/api/v1/doctor/me", headers=H_D2)
check("GET /me bác sĩ 2 -> tổng 2 lịch",
      r.status_code == 200 and r.json()["total_appointments"] == 2, r.text[:200])

r = client.get("/api/v1/doctor/appointments", headers=H_D1)
d = r.json()
check("danh sách chỉ có lịch của mình (tổng 7)",
      r.status_code == 200 and d["total"] == 7 and len(d["items"]) == 6, r.text[:200])
check("sắp xếp start_at giảm dần (lịch muộn nhất đầu tiên)",
      d["items"][0]["id"] == A7, str([x["id"] for x in d["items"]]))
check("item có đủ tên/email/SĐT bệnh nhân, giờ, lý do, trạng thái",
      d["items"][0]["patient_name"] == "Bệnh nhân Một"
      and d["items"][0]["patient_email"] == "bn1@test.vn"
      and d["items"][0]["patient_phone"] == "0900000001"
      and d["items"][0]["reason"] == "Đau đầu"
      and d["items"][0]["status"] == "pending", str(d["items"][0]))
r = client.get("/api/v1/doctor/appointments", headers=H_D2)
check("bác sĩ 2 chỉ thấy 2 lịch của mình",
      r.status_code == 200 and r.json()["total"] == 2, r.text[:200])

r = client.get("/api/v1/doctor/appointments?status=pending", headers=H_D1)
check("lọc status=pending -> 3", r.json()["total"] == 3, r.text[:200])
r = client.get("/api/v1/doctor/appointments?status=confirmed", headers=H_D1)
check("lọc status=confirmed -> 1", r.json()["total"] == 1, r.text[:200])
r = client.get("/api/v1/doctor/appointments?status=bogus", headers=H_D1)
check("lọc status không hợp lệ -> 400", r.status_code == 400, r.text[:200])
r = client.get("/api/v1/doctor/appointments?page=0", headers=H_D1)
check("page=0 -> 400", r.status_code == 400, r.text[:200])
r = client.get("/api/v1/doctor/appointments?page_size=101", headers=H_D1)
check("page_size=101 -> 400", r.status_code == 400, r.text[:200])
r = client.get("/api/v1/doctor/appointments?page=1&page_size=2", headers=H_D1)
d = r.json()
check("phân trang page_size=2 -> total_pages 4, 2 item",
      d["total_pages"] == 4 and len(d["items"]) == 2 and d["page"] == 1, r.text[:200])
r = client.get("/api/v1/doctor/appointments?page=4&page_size=2", headers=H_D1)
check("phân trang trang cuối -> 1 item",
      len(r.json()["items"]) == 1, r.text[:200])

print("== Doctor API: PATCH trạng thái ==")
r = client.patch(f"/api/v1/doctor/appointments/{A1}", headers=H_D1, json={"status": "confirmed"})
check("PENDING -> CONFIRMED (xác nhận) -> 200",
      r.status_code == 200 and r.json()["status"] == "confirmed", r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A1}", headers=H_D1, json={"status": "cancelled"})
check("CONFIRMED -> CANCELLED (hủy) -> 200",
      r.status_code == 200 and r.json()["status"] == "cancelled", r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A3}", headers=H_D1, json={"status": "cancelled"})
check("PENDING -> CANCELLED (hủy) -> 200",
      r.status_code == 200 and r.json()["status"] == "cancelled", r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A2}", headers=H_D1, json={"status": "completed"})
check("CONFIRMED -> COMPLETED (hoàn thành) -> 200",
      r.status_code == 200 and r.json()["status"] == "completed", r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A7}", headers=H_D1, json={"status": "pending"})
check("gửi lại cùng trạng thái (no-op) -> 200, vẫn pending",
      r.status_code == 200 and r.json()["status"] == "pending", r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A7}", headers=H_D1, json={"status": "completed"})
check("PENDING -> COMPLETED -> 400",
      r.status_code == 400, r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A4}", headers=H_D1, json={"status": "confirmed"})
check("CANCELLED -> CONFIRMED -> 400 + đúng thông báo",
      r.status_code == 400 and r.json().get("detail") == "Lịch đã hủy không thể đổi trạng thái khác", r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A5}", headers=H_D1, json={"status": "cancelled"})
check("COMPLETED -> CANCELLED -> 400",
      r.status_code == 400, r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A6}", headers=H_D1, json={"status": "confirmed"})
check("NO_SHOW -> CONFIRMED -> 400",
      r.status_code == 400, r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{B1}", headers=H_D1, json={"status": "confirmed"})
check("sửa lịch của bác sĩ khác -> 404 (không lộ thông tin)",
      r.status_code == 404, r.text[:200])
r = client.patch("/api/v1/doctor/appointments/99999", headers=H_D1, json={"status": "confirmed"})
check("sửa lịch không tồn tại -> 404", r.status_code == 404, r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A7}", headers=H_D1, json={"status": "bogus"})
check("status không hợp lệ -> 400", r.status_code == 400, r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A7}", headers=H_P2, json={"status": "confirmed"})
check("bệnh nhân PATCH -> 403", r.status_code == 403, r.text[:200])
r = client.patch(f"/api/v1/doctor/appointments/{A7}", json={"status": "confirmed"})
check("chưa đăng nhập PATCH -> 401", r.status_code == 401, r.text[:200])
r = client.get("/api/v1/doctor/appointments?status=cancelled", headers=H_D1)
check("sau các lần PATCH: lọc cancelled -> 3 (a1, a3, a4)",
      r.json()["total"] == 3, r.text[:200])

print("== Quên mật khẩu ==")
# bn2 vẫn giữ mật khẩu gốc PW (chỉ bn1 và admin đã đổi ở mục trên).
r = client.post("/api/v1/auth/forgot-password",
                json={"email": "khong-co@test.vn", "new_password": "matkhauMoi2"})
check("email chưa đăng ký -> 404 + đúng thông báo",
      r.status_code == 404 and r.json().get("detail") == "Email chưa được đăng ký", r.text[:200])
r = client.post("/api/v1/auth/forgot-password",
                json={"email": "bn2@test.vn", "new_password": "12345"})
check("mật khẩu mới < 6 ký tự -> 400", r.status_code == 400, r.text[:200])
r = client.post("/api/v1/auth/forgot-password",
                json={"email": "admin@test.vn", "new_password": "matkhauMoi2"})
check("tài khoản admin không đặt lại được qua form -> 403",
      r.status_code == 403, r.text[:200])
r = client.post("/api/v1/auth/forgot-password",
                json={"email": "bn2@test.vn", "new_password": "matkhauMoi2"})
check("đặt lại mật khẩu thành công -> 200 + đúng thông báo",
      r.status_code == 200 and r.json().get("message") == "Đã đặt lại mật khẩu, mời đăng nhập bằng mật khẩu mới.", r.text[:200])
r = client.post("/api/v1/auth/login", json={"email": "bn2@test.vn", "password": "matkhauMoi2"})
check("đăng nhập được bằng mật khẩu mới sau khi đặt lại", r.status_code == 200, r.text[:200])
r = client.post("/api/v1/auth/login", json={"email": "bn2@test.vn", "password": PW})
check("mật khẩu cũ không đăng nhập được nữa sau khi đặt lại", r.status_code == 401, r.text[:200])

print(f"\nKẾT QUẢ: {passed} pass, {failed} fail (tổng {passed + failed})")
if failures:
    print("FAILURES:", failures)

os.unlink(_tmp.name)
sys.exit(1 if failed else 0)
