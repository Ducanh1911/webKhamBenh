from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.doctor import Doctor, Specialty

router = APIRouter()

@router.get("/specialties")
def list_specialties(db: Session = Depends(get_db)):
    rows = db.query(Specialty).order_by(Specialty.name).all()
    return {"specialties": [{"id": s.id, "name": s.name, "description": s.description} for s in rows]}

@router.get("")
def list_doctors(specialty_id: int | None = None, db: Session = Depends(get_db)):
    q = (
        db.query(Doctor, User, Specialty)
        .join(User, User.id == Doctor.user_id)
        .join(Specialty, Specialty.id == Doctor.specialty_id)
    )
    if specialty_id:
        q = q.filter(Doctor.specialty_id == specialty_id)
    rows = q.order_by(Doctor.id).all()
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
        ]
    }
