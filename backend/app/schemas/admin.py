from datetime import datetime

from pydantic import BaseModel


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


class AppointmentStatusUpdate(BaseModel):
    status: str


class UserRoleUpdate(BaseModel):
    role: str
