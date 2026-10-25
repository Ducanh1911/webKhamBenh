from fastapi import APIRouter
router = APIRouter()

@router.get("/mine")
def my_appointments():
    # TODO: lấy lịch hẹn của user hiện tại, kèm nhắc lịch AI
    return {"appointments": []}

@router.post("")
def create_appointment():
    # TODO: kiểm tra slot trống, chống trùng lịch, tạo appointment PENDING
    return {"status": "pending"}
