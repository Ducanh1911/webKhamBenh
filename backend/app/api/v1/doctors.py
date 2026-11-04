from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.doctor import Doctor, Specialty

router = APIRouter()

def _page_params(page: int, page_size: int) -> tuple[int, int]:
    if page < 1:
        raise HTTPException(status_code=400, detail="Trang phải từ 1 trở lên")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Số dòng mỗi trang phải từ 1 đến 100")
    return page, page_size

@router.get("/specialties")
def list_specialties(db: Session = Depends(get_db)):
    rows = db.query(Specialty).order_by(Specialty.name).all()
    return {"specialties": [{"id": s.id, "name": s.name, "description": s.description} for s in rows]}

@router.get("")
def list_doctors(
    specialty_id: int | None = None,
    page: int = 1,
    page_size: int = 6,
    db: Session = Depends(get_db),
):
    page, page_size = _page_params(page, page_size)
    q = (
        db.query(Doctor, User, Specialty)
        .join(User, User.id == Doctor.user_id)
        .join(Specialty, Specialty.id == Doctor.specialty_id)
    )
    if specialty_id:
        q = q.filter(Doctor.specialty_id == specialty_id)
    total = q.count()
    rows = q.order_by(Doctor.id).offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {
        "doctors": [
            {
                "id": d.id,
                "name": u.full_name,
                "specialty_id": s.id,
                "specialty_name": s.name,
                "clinic_name": d.clinic_name,
                "years_experience": d.years_experience,
                "consultation_fee": d.consultation_fee,
                "bio": d.bio,
            }
            for d, u, s in rows
        ],
        "total": total, "page": page, "page_size": page_size, "total_pages": total_pages,
    }
