"""AI triage (Hướng A — rules-only, theo docs/triage-plan.md).

Nhận triệu chứng -> gợi ý chuyên khoa + mức ưu tiên.
Chỉ sàng lọc, KHÔNG chẩn đoán thay bác sĩ. Cần disclaimer ở UI.

Lớp LLM (OpenAI/Gemini) là lớp nâng cao đặt lên sau: khi chưa có key hoặc
LLM lỗi thì tự rơi về rules này, nên hàm này luôn chạy được offline,
không tốn tiền, không cần key.
"""

import re
import unicodedata

DISCLAIMER = (
    "Đây chỉ là gợi ý sàng lọc sơ bộ, không thay thế chẩn đoán của bác sĩ. "
    "Nếu có dấu hiệu nguy hiểm, hãy đi cấp cứu ngay."
)
EMERGENCY_MESSAGE = "Gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất ngay."

# id chuyên khoa đã xác nhận live 28/10 qua GET /api/v1/doctors/specialties
SPECIALTIES = {
    1: "Nội tổng quát",
    2: "Nhi khoa",
    3: "Răng hàm mặt",
    4: "Tim mạch",
    5: "Da liễu",
    6: "Mắt",
}

# Bác sĩ gợi ý theo chuyên khoa — id đã xác nhận live 28/10 qua
# GET /api/v1/doctors (chỉ dùng làm fallback khi DB không trả về bác sĩ).
FALLBACK_DOCTORS = {
    1: {"id": 1, "name": "BS. Nguyễn Văn An"},
    2: {"id": 2, "name": "BS. Trần Thị Bình"},
    3: {"id": 3, "name": "BS. Lê Minh Châu"},
    4: {"id": 4, "name": "BS. Phạm Quốc Dũng"},
    5: {"id": 5, "name": "BS. Hoàng Thu Hà"},
    6: {"id": 6, "name": "BS. Vũ Đức Khang"},
}

FOLLOW_UP_QUESTIONS = {
    1: [
        "Sốt bao nhiêu độ?",
        "Triệu chứng mấy ngày rồi?",
        "Có bệnh nền / đang uống thuốc gì không?",
    ],
    2: [
        "Bé mấy tuổi?",
        "Sốt bao nhiêu độ?",
        "Bé ăn/uống và chơi có bình thường không?",
    ],
    3: [
        "Đau tăng khi ăn nóng/lạnh không?",
        "Có sưng mặt không?",
        "Có sốt không?",
    ],
    4: [
        "Đau ngực lan ra tay/lưng không?",
        "Có khó thở khi gắng sức không?",
        "Có tiền sử tim mạch/huyết áp không?",
    ],
    5: [
        "Tổn thương ở đâu, bao lâu rồi?",
        "Có ngứa/rát không?",
        "Có dùng thuốc/kem gì chưa?",
    ],
    6: [
        "Mắt nào bị?",
        "Nhìn mờ đột ngột hay từ từ?",
        "Có chấn thương mắt không?",
    ],
}

# Dấu hiệu nguy hiểm -> emergency, ưu tiên cao nhất, vượt mọi mapping.
# Khớp trên văn bản đã bỏ dấu để "khó thở" và "kho tho" đều nhận được.
EMERGENCY_KEYWORDS = [
    "dau nguc du doi",
    "kho tho",
    "tim tai",
    "yeu mot ben nguoi",
    "liet mot ben",
    "liet nua nguoi",
    "noi kho",
    "co giat",
    "chay mau nhieu",
    "non ra mau",
    "chan thuong dau",
    "dau bung du doi",
    "bat tinh",
    "hon me",
    "ngung tho",
    "tho gap",
    "dau dau du doi",
    "sot cao co giat",
    "tieu ra mau",
    "di ngoai ra mau",
    "non lien tuc",
    "mat nuoc",
    "ngat xiu",
    "tim ngung dap",
    "dau bung cap",
]

# (từ khóa đã bỏ dấu, chuyên khoa id). Thứ tự trong list là thứ tự ưu tiên
# khi một câu khớp nhiều nhóm; Nhi khoa được xử lý riêng trước (xem dưới).
KEYWORD_RULES = [
    (["dau rang", "sung loi", "sau rang", "chay mau chan rang", "viem loi",
      "loet mieng", "nhiet mieng", "dau rang khon", "rang khon", "viem tuy",
      "rang lung lay", "ap xe", "dau ham", "hoi mieng", "chay mau rang",
      "viem quanh rang"], 3),
    (["dau nguc", "hoi hop", "tim dap nhanh", "huyet ap cao", "dau tim",
      "tim dap cham", "tim dap khong deu", "huyet ap thap", "chong mat",
      "ngat", "phu chan", "tim dap manh",
      "ho ve dem", "tuc nguc", "cao huyet ap", "huyet ap"], 4),
    (["noi man", "man ngua", "nam da", "rung toc", "di ung da", "viem da",
      "mun boc", "mun mu", "mun trung ca", "mun nhot", "noi mun", "man do",
      "di ung", "da kho", "da bong troc", "viem nang long", "nam mong",
      "lang ben", "bong nuoc", "phong rop", "dom do", "ngua da dau",
      "nut ne da"], 5),
    (["mo mat", "dau mat", "do mat", "chay nuoc mat", "mat mo", "can thi",
      "vien thi", "loan thi", "nhin mo", "nhuc mat", "cay mat", "ngua mat",
      "sup mi", "mat sung", "viem ket mac", "mat kho", "chay ghen mat",
      "mat nhin doi", "nhin doi", "dau nhuc mat"], 6),
    (["sot", "ho", "cam", "met", "dau dau", "dau bung", "tieu chay",
      "dau hong", "nghet mui", "bieng an", "phat ban", "sot cao", "ret run",
      "on lanh", "dau co", "dau khop", "sung khop", "buon non", "non oi",
      "mat ngu", "sut can", "tieu buot", "tieu rat", "dau lung", "dau vai",
      "te tay", "te chan", "viem hong", "khan tieng", "chay mui", "hat hoi",
      "so mui", "ngat mui", "viem mui", "viem xoang", "dau nua dau",
      "day hoi", "o chua", "tao bon", "ho khan", "ho dom", "dau da day",
      "tieu dem", "an khong ngon", "dau tai", "u tai", "viem tai"], 1),
]

# Từ khóa da liễu "ngứa/mụn" dễ nhầm với từ thường nên chỉ khớp khi đi
# cùng các từ khóa da liễu khác hoặc đứng một mình trong câu ngắn.
SKIN_EXTRA_KEYWORDS = ["ngua", "mun"]


def _normalize(text: str) -> str:
    """Hạ chữ thường + bỏ dấu tiếng Việt để khớp cả khi gõ không dấu."""
    text = text.lower().strip()
    text = "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )
    text = text.replace("đ", "d")
    return re.sub(r"\s+", " ", text)


def _contains_word(text: str, phrase: str) -> bool:
    return re.search(r"(?:^|[^a-z0-9])" + re.escape(phrase) + r"(?:[^a-z0-9]|$)", text) is not None


def _matched_keywords(text: str, keywords: list[str]) -> list[str]:
    return [k for k in keywords if _contains_word(text, k)]


def _is_child_case(text: str) -> bool:
    """Câu nói về trẻ em: 'bé', 'trẻ', 'em bé', 'con nhỏ'..."""
    return any(
        _contains_word(text, w)
        for w in ("be", "tre", "em be", "con nho", "con toi", "chau be")
    )


def suggest_specialty(symptoms: str) -> dict:
    """Rules triage. Trả về dict theo đúng format trong docs/triage-plan.md.

    specialty: {"id", "name"} hoặc None (ca emergency không khớp chuyên khoa).
    priority: "routine" | "urgent" | "emergency".
    """
    text = _normalize(symptoms or "")
    if not text:
        return {
            "specialty": None,
            "doctors": [],
            "priority": "routine",
            "follow_up_questions": [],
            "reason": "Chưa nhập triệu chứng.",
            "confidence": "low",
            "source": "rules",
            "disclaimer": DISCLAIMER,
        }

    # 1. Dấu hiệu nguy hiểm -> emergency, vượt mọi mapping.
    emergency_hits = _matched_keywords(text, EMERGENCY_KEYWORDS)
    if emergency_hits:
        specialty_id = _match_specialty_id(text)
        return {
            "specialty": (
                {"id": specialty_id, "name": SPECIALTIES[specialty_id]}
                if specialty_id
                else None
            ),
            "doctors": [],
            "priority": "emergency",
            "follow_up_questions": [],
            "reason": f"Dấu hiệu nguy hiểm: {', '.join(emergency_hits)}. {EMERGENCY_MESSAGE}",
            "confidence": "high",
            "source": "rules",
            "disclaimer": EMERGENCY_MESSAGE,
        }

    # 2. Khớp chuyên khoa theo từ khóa.
    specialty_id, matched = _match_specialty_id(text, return_keywords=True)
    if specialty_id is None:
        specialty_id, matched = 1, []
    # Triệu chứng chung chung chỉ khớp Nội tổng quát (sốt, ho, đau đầu, mệt)
    # thì độ tin cậy thấp; khớp chuyên khoa cụ thể thì độ tin cậy cao.
    confidence = "high" if specialty_id != 1 else "low"
    reason = (
        f"Khớp từ khóa: {', '.join(matched)}"
        if matched
        else "Không khớp từ khóa cụ thể nào, gợi ý mặc định Nội tổng quát (độ tin cậy thấp)."
    )
    return {
        "specialty": {"id": specialty_id, "name": SPECIALTIES[specialty_id]},
        "doctors": [FALLBACK_DOCTORS[specialty_id]],
        "priority": "routine",
        "follow_up_questions": FOLLOW_UP_QUESTIONS[specialty_id],
        "reason": reason,
        "confidence": confidence,
        "source": "rules",
        "disclaimer": DISCLAIMER,
    }


def _match_specialty_id(text: str, return_keywords: bool = False):
    """Trả về (specialty_id, matched_keywords) hoặc (None, []).

    Nhi khoa được ưu tiên khi câu nói về trẻ em và có triệu chứng
    (VD 'bé 3 tuổi sốt 38.5, ho' -> Nhi khoa, không phải Nội tổng quát).
    """
    if _is_child_case(text):
        child_keywords = [
            "sot", "ho", "cam", "met", "bieng an", "phat ban", "tieu chay",
            "dau bung", "dau dau", "non tro", "quay khoc", "tieu dem",
            "ho khan", "so mui", "bieng bu", "tay chan mieng", "sot cao",
            "dau tai", "tieu buot", "viem tai",
        ]
        matched = _matched_keywords(text, child_keywords)
        if matched:
            return (2, matched) if return_keywords else 2
    for keywords, specialty_id in KEYWORD_RULES:
        matched = _matched_keywords(text, keywords)
        if matched:
            return (specialty_id, matched) if return_keywords else specialty_id
    # Da liễu: "ngứa/mụn" chỉ khớp khi câu có thêm dấu hiệu da liễu khác
    # hoặc là triệu chứng chính của câu.
    skin_hits = _matched_keywords(text, SKIN_EXTRA_KEYWORDS)
    if skin_hits and (
        _contains_word(text, "khap nguoi")
        or _contains_word(text, "noi man")
        or len(text) < 40
    ):
        return (5, skin_hits) if return_keywords else 5
    return (None, []) if return_keywords else None
