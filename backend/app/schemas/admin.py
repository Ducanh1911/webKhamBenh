from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class AdminUserCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    password: str = Field(min_length=6)
    role: str = "patient"
    # Chỉ dùng khi role là bác sĩ: tạo thêm hồ sơ Doctor gắn với user mới.
    specialty_id: int | None = None
    clinic_name: str | None = None
    years_experience: int = Field(default=0, ge=0)
    consultation_fee: int = Field(default=0, ge=0)
    bio: str | None = None


class AdminAppointmentOut(BaseModel):
    id: int
    patient_id: int
    patient_name: str = ""
    patient_email: str = ""
    doctor_id: int
    doctor_name: str = ""
    specialty_name: str = ""
    clinic_name: str = ""
    start_at: datetime
    reason: str | None = None
    status: str


class AdminStatsOut(BaseModel):
    total_users: int
    total_doctors: int
    total_appointments: int
    pending_appointments: int
    confirmed_appointments: int
    cancelled_appointments: int


class AdminUserOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None = None
    role: str


class PaginatedAdminAppointmentsOut(BaseModel):
    items: list[AdminAppointmentOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedAdminUsersOut(BaseModel):
    items: list[AdminUserOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class AppointmentStatusUpdate(BaseModel):
    status: str


class UserRoleUpdate(BaseModel):
    role: str
