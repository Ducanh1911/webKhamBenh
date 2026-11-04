from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_non_admin
from app.models.user import User
from app.models.doctor import Doctor, Specialty
from app.models.appointment import Appointment, AppointmentStatus
from app.models.payment import Payment
from app.schemas.appointment import AppointmentCreate, AppointmentOut

router = APIRouter()

def _to_out(a: Appointment, db: Session) -> AppointmentOut:
    d = db.query(Doctor).filter(Doctor.id == a.doctor_id).first()
    name, spec, clinic, fee = "", "", "", 0
    if d:
        u = db.query(User).filter(User.id == d.user_id).first()
        s = db.query(Specialty).filter(Specialty.id == d.specialty_id).first()
        name = u.full_name if u else ""
        spec = s.name if s else ""
        clinic = d.clinic_name
        fee = d.consultation_fee
    latest_payment = (
        db.query(Payment)
        .filter(Payment.appointment_id == a.id)
        .order_by(Payment.id.desc())
        .first()
    )
    payment_status = (
        latest_payment.status.value if latest_payment else "unpaid"
    )
    return AppointmentOut(
        id=a.id, doctor_id=a.doctor_id, doctor_name=name, specialty_name=spec,
        clinic_name=clinic, start_at=a.start_at, reason=a.reason,
        status=a.status.value if hasattr(a.status, "value") else str(a.status),
        consultation_fee=fee, payment_status=payment_status,
        payment_id=latest_payment.id if latest_payment else None,
    )

@router.get("/mine")
def my_appointments(
    page: int = 1,
    page_size: int = 5,
    user: User = Depends(get_current_non_admin),
    db: Session = Depends(get_db),
):
    if page < 1:
        raise HTTPException(status_code=400, detail="Trang phải từ 1 trở lên")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Số dòng mỗi trang phải từ 1 đến 100")
    query = (
        db.query(Appointment)
        .filter(Appointment.patient_id == user.id)
        .order_by(Appointment.start_at.desc())
    )
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "appointments": [_to_out(a, db) for a in rows],
        "total": total, "page": page, "page_size": page_size, "total_pages": total_pages,
    }

@router.post("", response_model=AppointmentOut, status_code=201)
def create_appointment(payload: AppointmentCreate, user: User = Depends(get_current_non_admin), db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.id == payload.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Không tìm thấy bác sĩ")
    clash = (
        db.query(Appointment)
        .filter(
            Appointment.doctor_id == payload.doctor_id,
            Appointment.start_at == payload.start_at,
            Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
        )
        .first()
    )
    if clash:
        raise HTTPException(status_code=409, detail="Khung giờ này đã có người đặt, vui lòng chọn giờ khác")
    appt = Appointment(
        patient_id=user.id, doctor_id=payload.doctor_id,
        start_at=payload.start_at, reason=payload.reason,
        status=AppointmentStatus.PENDING,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return _to_out(appt, db)

@router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(appointment_id: int, user: User = Depends(get_current_non_admin), db: Session = Depends(get_db)):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id, Appointment.patient_id == user.id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch hẹn")
    if appt.status in (AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED):
        raise HTTPException(status_code=400, detail="Lịch hẹn này không thể hủy")
    appt.status = AppointmentStatus.CANCELLED
    db.commit()
    db.refresh(appt)
    return _to_out(appt, db)
