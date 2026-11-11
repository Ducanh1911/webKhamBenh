"""POST /api/v1/chat — Chatbot tư vấn sức khỏe (Hướng B, LLM OpenAI).

Không cần đăng nhập (như triage). Chạy triage rules trước để lấy chuyên
khoa / mức ưu tiên, tra bác sĩ từ DB, rồi gọi OpenAI soạn câu trả lời.
Chưa cấu hình key -> 503. OpenAI lỗi -> 502, không lộ chi tiết key.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat import ChatUnavailableError, chat_reply

router = APIRouter()


@router.post("", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Trợ lý AI chưa được cấu hình (thiếu khóa OpenAI).",
        )
    try:
        result = chat_reply([m.model_dump() for m in payload.messages], db)
    except ChatUnavailableError:
        raise HTTPException(
            status_code=502,
            detail="Trợ lý AI tạm thời không trả lời được, vui lòng thử lại sau.",
        )
    return ChatResponse(**result)
