"""API cho bác sĩ — chỉ tài khoản role doctor có hồ sơ Doctor mới gọi được.

Mọi endpoint đều dùng get_current_doctor (403 nếu không phải bác sĩ,
404 nếu chưa có hồ sơ), và chỉ trả / sửa lịch hẹn của chính bác sĩ đó:
lịch của bác sĩ khác trả 404 như thể không tồn tại, không lộ thông tin.
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_doctor
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor, Specialty
from app.models.user import User
from app.schemas.doctor import (
    DoctorAppointmentOut,
    DoctorAppointmentStatusUpdate,
    DoctorMeOut,
    PaginatedDoctorAppointmentsOut,
)

router = APIRouter()

# Múi giờ sản phẩm (giờ Việt Nam): "lịch hôm nay" tính theo ngày ở VN,
# khớp với cách frontend hiển thị giờ khám bằng locale vi-VN.
_VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

# Chuyển trạng thái hợp lệ cho bác sĩ. CANCELLED và COMPLETED là trạng
# thái cuối (giống quy tắc ở admin.py: lịch đã hủy không đổi được nữa).
_ALLOWED_TRANSITIONS: dict[AppointmentStatus, set[AppointmentStatus]] = {
    AppointmentStatus.PENDING: {AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED},
    AppointmentStatus.CONFIRMED: {AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED},
}

_STATUS_LABEL = {
    AppointmentStatus.PENDING: "Chờ xác nhận",
    AppointmentStatus.CONFIRMED: "Đã xác nhận",
    AppointmentStatus.COMPLETED: "Đã khám xong",
    AppointmentStatus.CANCELLED: "Đã hủy",
    AppointmentStatus.NO_SHOW: "Không đến khám",
}


def _status_str(status) -> str:
    return status.value if hasattr(status, "value") else str(status)


def _page_params(page: int, page_size: int) -> tuple[int, int]:
    if page < 1:
        raise HTTPException(status_code=400, detail="Trang phải từ 1 trở lên")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Số dòng mỗi trang phải từ 1 đến 100")
    return page, page_size


def _to_out(a: Appointment, db: Session) -> DoctorAppointmentOut:
    patient = db.query(User).filter(User.id == a.patient_id).first()
    return DoctorAppointmentOut(
        id=a.id,
        patient_id=a.patient_id,
        patient_name=patient.full_name if patient else "",
        patient_email=patient.email if patient else "",
        patient_phone=patient.phone if patient else None,
        start_at=a.start_at,
        reason=a.reason,
        status=_status_str(a.status),
    )


@router.get("/me", response_model=DoctorMeOut)
def doctor_me(doctor: Doctor = Depends(get_current_doctor), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == doctor.user_id).first()
    spec = db.query(Specialty).filter(Specialty.id == doctor.specialty_id).first()
    base = db.query(Appointment).filter(Appointment.doctor_id == doctor.id)
    today = datetime.now(_VN_TZ).date()
    day_start = datetime.combine(today, time.min, tzinfo=_VN_TZ)
    day_end = day_start + timedelta(days=1)
    return DoctorMeOut(
        doctor_id=doctor.id,
        user_id=doctor.user_id,
        full_name=user.full_name if user else "",
        email=user.email if user else "",
        phone=user.phone if user else None,
        specialty_id=doctor.specialty_id,
        specialty_name=spec.name if spec else "",
        clinic_name=doctor.clinic_name,
        years_experience=doctor.years_experience,
        consultation_fee=doctor.consultation_fee,
        bio=doctor.bio,
        total_appointments=base.count(),
        pending_appointments=base.filter(Appointment.status == AppointmentStatus.PENDING).count(),
        confirmed_appointments=base.filter(Appointment.status == AppointmentStatus.CONFIRMED).count(),
        today_appointments=base.filter(
            Appointment.start_at >= day_start, Appointment.start_at < day_end
        ).count(),
    )


@router.get("/appointments", response_model=PaginatedDoctorAppointmentsOut)
def list_my_appointments(
    status: str | None = None,
    page: int = 1,
    page_size: int = 6,
    doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    page, page_size = _page_params(page, page_size)
    query = (
        db.query(Appointment)
        .filter(Appointment.doctor_id == doctor.id)
        .order_by(Appointment.start_at.desc())
    )
    if status:
        try:
            query = query.filter(Appointment.status == AppointmentStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ")
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if total else 0
    return PaginatedDoctorAppointmentsOut(
        items=[_to_out(a, db) for a in rows],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    )


@router.patch("/appointments/{appointment_id}", response_model=DoctorAppointmentOut)
def update_appointment_status(
    appointment_id: int,
    payload: DoctorAppointmentStatusUpdate,
    doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    try:
        new_status = AppointmentStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Trạng thái không hợp lệ")
    # Chỉ lịch của chính mình mới sửa được; lịch của bác sĩ khác trả 404
    # như thể không tồn tại để không lộ thông tin bệnh nhân của họ.
    appt = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id, Appointment.doctor_id == doctor.id)
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch hẹn")
    current = appt.status
    if new_status == current:
        # Gửi lại cùng trạng thái là no-op (idempotent), giống cách admin
        # cho phép giữ nguyên trạng thái của lịch đã hủy.
        return _to_out(appt, db)
    if current == AppointmentStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Lịch đã hủy không thể đổi trạng thái khác")
    if current == AppointmentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Lịch đã khám xong không thể đổi trạng thái")
    if current == AppointmentStatus.NO_SHOW:
        raise HTTPException(status_code=400, detail="Lịch bệnh nhân không đến khám không thể đổi trạng thái")
    if new_status not in _ALLOWED_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Không thể đổi lịch từ '{_STATUS_LABEL[current]}' sang '{_STATUS_LABEL[new_status]}'",
        )
    appt.status = new_status
    db.commit()
    db.refresh(appt)
    return _to_out(appt, db)
