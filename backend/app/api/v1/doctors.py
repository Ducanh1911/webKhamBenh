from fastapi import APIRouter
router = APIRouter()

@router.get("")
def list_doctors(specialty: str | None = None):
    # TODO: query DB, filter theo chuyên khoa, sắp xếp theo đánh giá
    return {"doctors": [], "specialty": specialty}
