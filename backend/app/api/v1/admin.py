"""API quản trị — chỉ tài khoản role admin mới gọi được.

Mọi endpoint đều dùng get_current_admin (403 nếu là tài khoản thường),
nên frontend chỉ ẩn nút là chưa đủ: backend mới là nơi chặn thật.
Không endpoint nào ở đây trả về hashed_password.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor, Specialty
from app.models.user import User, UserRole
from app.schemas.admin import (
    AdminAppointmentOut,
    AdminStatsOut,
    AdminUserOut,
    AppointmentStatusUpdate,
    UserRoleUpdate,
)

router = APIRouter()

_ALLOWED_STATUSES = {
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
}


def _status_str(status) -> str:
    return status.value if hasattr(status, "value") else str(status)


def _to_out(a: Appointment, db: Session) -> AdminAppointmentOut:
    patient = db.query(User).filter(User.id == a.patient_id).first()
    doctor = db.query(Doctor).filter(Doctor.id == a.doctor_id).first()
    doctor_name, spec_name, clinic = "", "", ""
    if doctor:
        doctor_user = db.query(User).filter(User.id == doctor.user_id).first()
        spec = db.query(Specialty).filter(Specialty.id == doctor.specialty_id).first()
        doctor_name = doctor_user.full_name if doctor_user else ""
        spec_name = spec.name if spec else ""
        clinic = doctor.clinic_name
    return AdminAppointmentOut(
        id=a.id,
        patient_id=a.patient_id,
        patient_name=patient.full_name if patient else "",
        patient_email=patient.email if patient else "",
        doctor_id=a.doctor_id,
        doctor_name=doctor_name,
        specialty_name=spec_name,
        clinic_name=clinic,
        start_at=a.start_at,
        reason=a.reason,
        status=_status_str(a.status),
    )


@router.get("/stats", response_model=AdminStatsOut)
def stats(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return AdminStatsOut(
        total_users=db.query(User).count(),
        total_doctors=db.query(Doctor).count(),
        total_appointments=db.query(Appointment).count(),
        pending_appointments=db.query(Appointment)
        .filter(Appointment.status == AppointmentStatus.PENDING).count(),
        confirmed_appointments=db.query(Appointment)
        .filter(Appointment.status == AppointmentStatus.CONFIRMED).count(),
        cancelled_appointments=db.query(Appointment)
        .filter(Appointment.status == AppointmentStatus.CANCELLED).count(),
    )


@router.get("/appointments", response_model=list[AdminAppointmentOut])
def list_appointments(
    status: str | None = None,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(Appointment).order_by(Appointment.start_at.desc())
    if status:
        try:
            query = query.filter(Appointment.status == AppointmentStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ")
    return [_to_out(a, db) for a in query.all()]


@router.patch("/appointments/{appointment_id}", response_model=AdminAppointmentOut)
def update_appointment_status(
    appointment_id: int,
    payload: AppointmentStatusUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        new_status = AppointmentStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ")
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch hẹn")
    # Lịch đã hủy thì không xác nhận / hoàn thành lại được; muốn đặt lại
    # thì bệnh nhân đặt lịch mới. Admin vẫn có thể giữ nguyên trạng thái.
    if appt.status == AppointmentStatus.CANCELLED and new_status != AppointmentStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Lịch đã hủy không thể đổi trạng thái khác")
    appt.status = new_status
    db.commit()
    db.refresh(appt)
    return _to_out(appt, db)


@router.get("/users", response_model=list[AdminUserOut])
def list_users(admin: User = Depends(get_current_admin), db: Session = Depends(get_db)):
    rows = db.query(User).order_by(User.id).all()
    return [
        AdminUserOut(
            id=u.id, full_name=u.full_name, email=u.email, phone=u.phone,
            role=_status_str(u.role),
        )
        for u in rows
    ]


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        new_role = UserRole(payload.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Role không hợp lệ")
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Không thể tự đổi role của chính mình")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    target.role = new_role
    db.commit()
    db.refresh(target)
    return AdminUserOut(
        id=target.id, full_name=target.full_name, email=target.email,
        phone=target.phone, role=_status_str(target.role),
    )
