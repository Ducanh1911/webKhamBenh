"""POST /api/v1/triage — AI triage Hướng A (rules-only, docs/triage-plan.md).

Không cần đăng nhập để thử. Không lưu triệu chứng vào DB ở bản đầu.
Bác sĩ gợi ý được lấy từ DB theo chuyên khoa; nếu DB chưa có bác sĩ cho
chuyên khoa đó thì rơi về bác sĩ đã xác nhận live trong ai_triage.py.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.doctor import Doctor
from app.models.user import User
from app.schemas.triage import DoctorOut, SpecialtyOut, TriageRequest, TriageResponse
from app.services.ai_triage import FALLBACK_DOCTORS, suggest_specialty

router = APIRouter()


@router.post("", response_model=TriageResponse)
def triage(payload: TriageRequest, db: Session = Depends(get_db)):
    result = suggest_specialty(payload.symptoms)
    specialty = result["specialty"]

    doctors: list[dict] = []
    if specialty is not None:
        # Kể cả ca emergency vẫn trả bác sĩ của chuyên khoa khớp được
        # (để khớp bảng test trong triage-plan.md); UI sẽ không cho đặt
        # lịch thường khi priority = emergency mà hiện gọi cấp cứu 115.
        rows = (
            db.query(Doctor, User)
            .join(User, User.id == Doctor.user_id)
            .filter(Doctor.specialty_id == specialty["id"])
            .order_by(Doctor.id)
            .all()
        )
        doctors = [{"id": d.id, "name": u.full_name} for d, u in rows]
        if not doctors:
            doctors = [FALLBACK_DOCTORS[specialty["id"]]]

    return TriageResponse(
        specialty=SpecialtyOut(**specialty) if specialty else None,
        doctors=[DoctorOut(**d) for d in doctors],
        priority=result["priority"],
        follow_up_questions=result["follow_up_questions"],
        reason=result["reason"],
        confidence=result["confidence"],
        source=result["source"],
        disclaimer=result["disclaimer"],
    )
