"""Chatbot tư vấn sức khỏe (Hướng B — lớp LLM Google Gemini, model gemini-3-flash-preview, free tier).

Luồng: tin nhắn mới nhất của user -> chạy triage rules (Hướng A) để lấy
chuyên khoa / mức ưu tiên -> tra bác sĩ của chuyên khoa đó từ DB -> đưa
tất cả vào system instruction rồi gọi Gemini soạn câu trả lời tiếng Việt.
LLM chỉ được nói về bác sĩ / phí khám có trong context, không được bịa.
Dấu hiệu nguy hiểm (priority=emergency) -> bắt buộc gọi cấp cứu 115.

Key chỉ đọc từ settings.GEMINI_API_KEY (biến môi trường trên Render),
không hardcode, không ghi log. Chưa có key hoặc Gemini lỗi thì endpoint
trả lỗi có ý nghĩa, không crash server.
"""

import logging

from google import genai
from google.genai import types
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.doctor import Doctor
from app.models.user import User
from app.services.ai_triage import suggest_specialty

logger = logging.getLogger(__name__)

MAX_HISTORY = 10  # tối đa 10 tin gần nhất gửi cho LLM

SYSTEM_PROMPT = """Bạn là trợ lý sức khỏe MediBook AI — hệ thống đặt lịch khám bệnh trực tuyến.
Nhiệm vụ: tư vấn sơ bộ bằng tiếng Việt, ngắn gọn, thân thiện, dễ hiểu.
Quy tắc bắt buộc:
- Chỉ dùng THÔNG TIN ĐƯỢC CUNG CẤP dưới đây để nói về bác sĩ, chuyên khoa, phí khám. Không bịa tên bác sĩ, phí khám hay giờ làm việc.
- Nếu mức ưu tiên là emergency: BẮT BUỘC yêu cầu người dùng gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất ngay, và KHÔNG gợi ý đặt lịch khám thường.
- Không chẩn đoán xác định bệnh, không kê đơn thuốc, không thay thế bác sĩ.
- Khi người dùng hỏi về đặt lịch: hướng dẫn mở tab "Đặt lịch khám", chọn bác sĩ, ngày và giờ khám, rồi bấm xác nhận. Hủy lịch: vào tab "Lịch hẹn của tôi", bấm "Hủy lịch".
- Thanh toán: thanh toán bằng ví MoMo sau khi đặt lịch; phí khám từ 180.000đ đến 300.000đ tùy bác sĩ.
- Các chuyên khoa của hệ thống: Nội tổng quát, Nhi khoa, Răng hàm mặt, Tim mạch, Da liễu, Mắt.
- Cuối câu trả lời, nhắc ngắn gọn đây chỉ là tư vấn sơ bộ, không thay thế bác sĩ.
"""


class ChatUnavailableError(Exception):
    """Gemini không trả lời được (key sai, hết quota, timeout, lỗi mạng)."""


def _build_system_prompt(triage: dict, doctors: list[dict]) -> str:
    """Ghép kết quả triage + danh sách bác sĩ vào system prompt."""
    specialty = triage["specialty"]
    lines = ["THÔNG TIN ĐƯỢC CUNG CẤP (chỉ dùng thông tin này để trả lời):"]
    if specialty:
        lines.append(f"- Chuyên khoa gợi ý từ triệu chứng: {specialty['name']}.")
    else:
        lines.append("- Chưa gợi ý được chuyên khoa cụ thể từ triệu chứng.")
    lines.append(f"- Mức ưu tiên: {triage['priority']}.")
    lines.append(f"- Lý do sàng lọc: {triage['reason']}")
    if triage["follow_up_questions"]:
        lines.append(
            "- Câu hỏi làm rõ có thể hỏi thêm: "
            + "; ".join(triage["follow_up_questions"])
        )
    if doctors:
        lines.append("- Bác sĩ của chuyên khoa gợi ý:")
        for d in doctors:
            fee = f"{d['consultation_fee']:,}".replace(",", ".")
            lines.append(
                f"  + {d['name']} — phí khám {fee}đ, "
                f"{d['years_experience']} năm kinh nghiệm."
            )
    else:
        lines.append("- Không có bác sĩ cụ thể để gợi ý lúc này.")
    return SYSTEM_PROMPT + "\n" + "\n".join(lines)


def _to_gemini_contents(messages: list[dict]) -> list[types.Content]:
    """Chuyển history [{role: user|assistant, content}] sang format Gemini.

    Gemini dùng role "model" thay cho "assistant", và tin đầu tiên phải là
    user nên bỏ các tin model mở đầu nếu có.
    """
    contents: list[types.Content] = []
    for m in messages:
        role = "model" if m["role"] == "assistant" else "user"
        contents.append(
            types.Content(
                role=role, parts=[types.Part.from_text(text=m["content"])]
            )
        )
    while contents and contents[0].role == "model":
        contents.pop(0)
    return contents


def chat_reply(messages: list[dict], db: Session) -> dict:
    """Trả lời một lượt chat.

    messages: list {role, content} đã validate (tối đa 10, cuối là user).
    Trả về dict {reply, specialty, doctors, priority, disclaimer}.
    """
    latest = messages[-1]["content"]
    triage = suggest_specialty(latest)
    specialty = triage["specialty"]

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

    system = _build_system_prompt(triage, doctors)
    history = messages[-MAX_HISTORY:]
    try:
        client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=30_000),
        )
        resp = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=_to_gemini_contents(history),
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.3,
                max_output_tokens=600,
            ),
        )
        try:
            reply = (resp.text or "").strip()
        except ValueError:
            # Model không trả text (vd bị chặn): coi như rỗng.
            reply = ""
    except Exception as e:  # key sai, hết quota, timeout, lỗi mạng...
        # Chỉ log tên lỗi, KHÔNG log key hay nội dung request.
        logger.warning("Gemini chat failed: %s", type(e).__name__)
        raise ChatUnavailableError("Gemini không trả lời được.") from e
    if not reply:
        raise ChatUnavailableError("Gemini trả về câu trả lời rỗng.")

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
