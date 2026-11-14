from datetime import datetime

from pydantic import BaseModel


class DoctorMeOut(BaseModel):
    doctor_id: int
    user_id: int
    full_name: str
    email: str
    phone: str | None = None
    specialty_id: int
    specialty_name: str
    clinic_name: str
    years_experience: int
    consultation_fee: int
    bio: str | None = None
    # Thống kê chỉ tính trên lịch hẹn của chính bác sĩ này.
    total_appointments: int
    pending_appointments: int
    confirmed_appointments: int
    today_appointments: int


class DoctorAppointmentOut(BaseModel):
    id: int
    patient_id: int
    patient_name: str = ""
    patient_email: str = ""
    patient_phone: str | None = None
    start_at: datetime
    reason: str | None = None
    status: str


class PaginatedDoctorAppointmentsOut(BaseModel):
    items: list[DoctorAppointmentOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class DoctorAppointmentStatusUpdate(BaseModel):
    status: str
