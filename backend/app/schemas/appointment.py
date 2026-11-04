from datetime import datetime
from pydantic import BaseModel

class AppointmentCreate(BaseModel):
    doctor_id: int
    start_at: datetime
    reason: str | None = None

class AppointmentOut(BaseModel):
    id: int
    doctor_id: int
    doctor_name: str = ""
    specialty_name: str = ""
    clinic_name: str = ""
    start_at: datetime
    reason: str | None = None
    status: str
    consultation_fee: int = 0
    # Trạng thái thanh toán mới nhất: unpaid | pending | success | failed
    payment_status: str = "unpaid"
    payment_id: int | None = None
