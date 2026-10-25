"""AI triage: nhận triệu chứng -> gợi ý chuyên khoa + mức ưu tiên.
Chỉ sàng lọc, KHÔNG chẩn đoán thay bác sĩ. Cần disclaimer ở UI."""
def suggest_specialty(symptoms: str) -> dict:
    # TODO: gọi LLM + pgvector tra cứu kiến thức triệu chứng -> chuyên khoa
    return {"specialty": None, "priority": "routine", "note": "Cần bác sĩ xác nhận"}
