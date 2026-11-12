"""Chatbot tư vấn sức khỏe (Hướng B — lớp LLM Google Gemini, model gemini-3-flash-preview, free tier).

Gọi Gemini qua REST API trực tiếp bằng httpx (không dùng SDK google-genai:
SDK trả ClientError trên Render dù cùng request gọi REST thì thành công).

Luồng: tin nhắn mới nhất của user -> phân loại ý định -> chỉ chạy triage
gợi ý chuyên khoa khi câu hỏi MÔ TẢ TRIỆU CHỨNG cụ thể (khớp từ khóa
triệu chứng); hỏi cách dùng hệ thống (đặt/hủy lịch, thanh toán...) hoặc
câu hỏi ngoài lề thì KHÔNG gợi ý chuyên khoa/bác sĩ — LLM trả lời hướng
dẫn hoặc hỏi lại cụ thể. Hỏi trực tiếp về bác sĩ của một chuyên khoa
("Bác sĩ tim mạch") thì giới thiệu bác sĩ của chuyên khoa đó. Chuyên
khoa/bác sĩ gợi ý được tra từ DB rồi đưa vào system instruction để
Gemini soạn câu trả lời tiếng Việt. LLM chỉ được nói về bác sĩ / phí
khám có trong context, không được bịa. Dấu hiệu nguy hiểm
(priority=emergency) -> bắt buộc gọi cấp cứu 115.

Key chỉ đọc từ settings.GEMINI_API_KEY (biến môi trường trên Render),
không hardcode, không ghi log. Chưa có key hoặc Gemini lỗi thì endpoint
trả lỗi có ý nghĩa, không crash server.
"""

import logging

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.doctor import Doctor
from app.models.user import User
from app.services.ai_triage import (
    SPECIALTIES,
    is_howto_question,
    match_specialty_name,
    suggest_specialty,
)

logger = logging.getLogger(__name__)

MAX_HISTORY = 10  # tối đa 10 tin gần nhất gửi cho LLM
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

SYSTEM_PROMPT = """Bạn là trợ lý sức khỏe MediBook AI — hệ thống đặt lịch khám bệnh trực tuyến.
Nhiệm vụ: tư vấn sơ bộ bằng tiếng Việt, ngắn gọn, thân thiện, dễ hiểu.
Quy tắc bắt buộc:
- Chỉ dùng THÔNG TIN ĐƯỢC CUNG CẤP dưới đây để nói về bác sĩ, chuyên khoa, phí khám. Không bịa tên bác sĩ, phí khám hay giờ làm việc.
- Nếu mức ưu tiên là emergency: BẮT BUỘC yêu cầu người dùng gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất ngay, và KHÔNG gợi ý đặt lịch khám thường.
- Không chẩn đoán xác định bệnh, không kê đơn thuốc, không thay thế bác sĩ.
- Chỉ gợi ý chuyên khoa/bác sĩ khi người dùng đã mô tả triệu chứng cụ thể. Nếu chưa rõ triệu chứng, hỏi lại cụ thể (triệu chứng gì, ở đâu, từ khi nào, mức độ ra sao) thay vì gợi ý.
- Khi người dùng hỏi về đặt lịch: hướng dẫn từng bước — đăng nhập (hoặc đăng ký tài khoản), mở tab "Đặt lịch khám", chọn chuyên khoa rồi chọn bác sĩ, chọn ngày và khung giờ (08:00, 09:00, 10:00, 11:00, 13:30, 14:30, 15:30, 16:30), nhập lý do khám, bấm xác nhận. Hủy lịch: vào tab "Lịch hẹn của tôi", bấm "Hủy lịch" rồi xác nhận.
- Thanh toán: thanh toán bằng ví MoMo sau khi đặt lịch; phí khám từ 180.000đ đến 300.000đ tùy bác sĩ.
- Các chuyên khoa của hệ thống: Nội tổng quát, Nhi khoa, Răng hàm mặt, Tim mạch, Da liễu, Mắt.
- Cuối câu trả lời, nhắc ngắn gọn đây chỉ là tư vấn sơ bộ, không thay thế bác sĩ.
"""


class ChatUnavailableError(Exception):
    """Gemini không trả lời được (key sai, hết quota, timeout, lỗi mạng)."""


def _classify(latest: str, triage: dict) -> tuple[str, dict | None]:
    """Phân loại ý định của tin nhắn mới nhất.

    Trả về (intent, specialty). Chỉ gợi ý chuyên khoa khi:
    - intent "symptom": câu hỏi mô tả triệu chứng cụ thể (khớp từ khóa
      triage) hoặc có dấu hiệu nguy hiểm -> specialty từ triage;
    - intent "specialty_info": user hỏi trực tiếp về bác sĩ của một
      chuyên khoa ("Bác sĩ tim mạch") -> specialty theo tên nhắc đến.
    Các trường hợp còn lại KHÔNG gợi ý chuyên khoa/bác sĩ:
    - "howto": hỏi cách dùng hệ thống (đặt/hủy lịch, thanh toán...);
    - "unclear": câu hỏi ngoài lề hoặc quá chung chung -> hỏi lại cụ thể.
    Thứ tự ưu tiên: triệu chứng > tên chuyên khoa > cách dùng > chưa rõ.
    """
    if triage["priority"] == "emergency" or triage["matched_keywords"]:
        return "symptom", triage["specialty"]
    specialty_id = match_specialty_name(latest)
    if specialty_id is not None:
        return "specialty_info", {
            "id": specialty_id,
            "name": SPECIALTIES[specialty_id],
        }
    if is_howto_question(latest):
        return "howto", None
    return "unclear", None


def _build_system_prompt(
    triage: dict, doctors: list[dict], intent: str, specialty: dict | None
) -> str:
    """Ghép kết quả triage + bác sĩ + ý định vào system prompt.

    Chỉ intent symptom / specialty_info mới có chuyên khoa + bác sĩ;
    howto / unclear thì bắt buộc LLM không gợi ý mà trả lời hướng dẫn
    hoặc hỏi lại cụ thể.
    """
    lines = ["THÔNG TIN ĐƯỢC CUNG CẤP (chỉ dùng thông tin này để trả lời):"]
    if intent == "symptom":
        if specialty:
            lines.append(f"- Chuyên khoa gợi ý từ triệu chứng: {specialty['name']}.")
        lines.append(f"- Mức ưu tiên: {triage['priority']}.")
        lines.append(f"- Lý do sàng lọc: {triage['reason']}")
        if triage["confidence"] == "low":
            lines.append(
                "- Độ tin cậy thấp: triệu chứng còn chung chung, gợi ý chuyên khoa "
                "một cách thận trọng và hỏi thêm để làm rõ triệu chứng."
            )
        if triage["follow_up_questions"]:
            lines.append(
                "- Câu hỏi làm rõ có thể hỏi thêm: "
                + "; ".join(triage["follow_up_questions"])
            )
    elif intent == "specialty_info":
        lines.append(
            f"- Người dùng đang hỏi về bác sĩ của chuyên khoa {specialty['name']}, "
            "không phải mô tả triệu chứng. Giới thiệu bác sĩ + phí khám của "
            "chuyên khoa đó và hướng dẫn đặt lịch ở tab Đặt lịch khám."
        )
        lines.append(f"- Mức ưu tiên: {triage['priority']}.")
    elif intent == "howto":
        lines.append(
            "- Người dùng đang hỏi CÁCH DÙNG hệ thống (đặt/hủy lịch, đăng ký, "
            "thanh toán...), KHÔNG mô tả triệu chứng. Trả lời đúng câu hỏi "
            "bằng hướng dẫn cụ thể từng bước. KHÔNG gợi ý chuyên khoa/bác sĩ."
        )
    else:  # unclear
        lines.append(
            "- Người dùng chưa mô tả triệu chứng cụ thể (câu hỏi ngoài lề "
            "hoặc quá chung chung). KHÔNG gợi ý chuyên khoa/bác sĩ. Hỏi lại "
            "cụ thể: triệu chứng gì, ở đâu, từ khi nào, mức độ ra sao; nói "
            "ngắn gọn bạn có thể giúp mô tả triệu chứng, hỏi về bác sĩ hoặc "
            "hướng dẫn đặt lịch."
        )
    if doctors:
        lines.append("- Bác sĩ để giới thiệu:")
        for d in doctors:
            fee = f"{d['consultation_fee']:,}".replace(",", ".")
            lines.append(
                f"  + {d['name']} — phí khám {fee}đ, "
                f"{d['years_experience']} năm kinh nghiệm."
            )
    else:
        lines.append("- Không có bác sĩ cụ thể để gợi ý lúc này.")
    return SYSTEM_PROMPT + "\n" + "\n".join(lines)


def _to_gemini_contents(messages: list[dict]) -> list[dict]:
    """Chuyển history [{role: user|assistant, content}] sang format Gemini.

    Gemini dùng role "model" thay cho "assistant", và tin đầu tiên phải là
    user nên bỏ các tin model mở đầu nếu có.
    """
    contents: list[dict] = []
    for m in messages:
        role = "model" if m["role"] == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": m["content"]}]})
    while contents and contents[0]["role"] == "model":
        contents.pop(0)
    return contents


def _call_gemini(system: str, history: list[dict]) -> str:
    """Gọi Gemini generateContent qua REST API, trả về text trả lời.

    Raise ChatUnavailableError khi key sai, hết quota, timeout, lỗi mạng
    hay model không trả text. Chỉ log tên lỗi, KHÔNG log key.
    """
    url = (
        f"{GEMINI_API_BASE}/models/{settings.GEMINI_MODEL}:generateContent"
    )
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": _to_gemini_contents(history),
        # 600 token quá ít cho gemini-3-flash-preview: model dùng token
        # "suy nghĩ" chung ngân sách maxOutputTokens nên câu trả lời bị
        # cụt giữa chừng (~30 token). 2048 đủ cho cả suy nghĩ lẫn trả lời.
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 2048},
    }
    try:
        resp = httpx.post(
            url,
            params={"key": settings.GEMINI_API_KEY},
            json=payload,
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:  # key sai, hết quota, timeout, lỗi mạng...
        # Chỉ log tên lỗi, KHÔNG log key hay nội dung request.
        logger.warning("Gemini chat failed: %s", type(e).__name__)
        raise ChatUnavailableError("Gemini không trả lời được.") from e
    # Log lý do dừng + số token để chẩn đoán câu trả lời cụt (không log
    # nội dung chat, không log key).
    try:
        usage = data.get("usageMetadata", {}) or {}
        finish = data["candidates"][0].get("finishReason", "")
        logger.info(
            "Gemini chat: finish=%s tokens prompt=%s candidates=%s total=%s",
            finish,
            usage.get("promptTokenCount"),
            usage.get("candidatesTokenCount"),
            usage.get("totalTokenCount"),
        )
    except (KeyError, IndexError, TypeError, AttributeError):
        pass
    try:
        parts = data["candidates"][0]["content"]["parts"]
        reply = "".join(p.get("text", "") for p in parts).strip()
    except (KeyError, IndexError, TypeError):
        reply = ""
    if not reply:
        raise ChatUnavailableError("Gemini trả về câu trả lời rỗng.")
    return reply


def chat_reply(messages: list[dict], db: Session) -> dict:
    """Trả lời một lượt chat.

    messages: list {role, content} đã validate (tối đa 10, cuối là user).
    Trả về dict {reply, specialty, doctors, priority, disclaimer}.
    """
    latest = messages[-1]["content"]
    triage = suggest_specialty(latest)
    intent, specialty = _classify(latest, triage)

    doctors: list[dict] = []
    if specialty is not None:
        rows = (
            db.query(Doctor, User)
            .join(User, User.id == Doctor.user_id)
            .filter(Doctor.specialty_id == specialty["id"])
            .order_by(Doctor.id)
            .all()
        )
        doctors = [
            {
                "id": d.id,
                "name": u.full_name,
                "consultation_fee": d.consultation_fee,
                "years_experience": d.years_experience,
            }
            for d, u in rows
        ]

    system = _build_system_prompt(triage, doctors, intent, specialty)
    history = messages[-MAX_HISTORY:]
    reply = _call_gemini(system, history)

    return {
        "reply": reply,
        "specialty": specialty,
        "doctors": [
            {
                "id": d["id"],
                "name": d["name"],
                "consultation_fee": d["consultation_fee"],
            }
            for d in doctors
        ],
        "priority": triage["priority"],
        "disclaimer": triage["disclaimer"],
    }
