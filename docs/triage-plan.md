# AI Triage — bản chuẩn bị (chưa code, chưa commit)

Ngày chuẩn bị: 28/10/2026. Mục đích: để anh chỉ cần chọn 1 trong 3 hướng là làm được ngay,
không phải bàn lại từ đầu. Quyết định triage đã gửi anh lúc 10:59 ngày 28/10 vẫn chưa có hồi đáp.

> **Đã triển khai Hướng A (rules-only) ngày 28/10/2026:** `POST /api/v1/triage`
> + `ai_triage.py` rules + ô triệu chứng trên Dashboard. 8/8 ca test tay pass
> (service + API với DB SQLite seed giống Neon). Chưa code lớp LLM — vẫn chờ
> quyết định provider/key cho Hướng B.

## Vấn đề hiện tại (đã kiểm chứng lại ngày 28/10)

- `backend/app/services/ai_triage.py` chỉ là stub: `suggest_specialty()` trả
  `{"specialty": None, "priority": "routine", "note": "Cần bác sĩ xác nhận"}`.
- `backend/app/main.py` chỉ có 3 router: auth / doctors / appointments — chưa có endpoint triage.
- `backend/app/core/config.py`: `OPENAI_API_KEY` mặc định `""`; `.env.example` chỉ là placeholder.
  Không có bằng chứng đã có key trên Render — không đoán là đã có.
- Sẵn có để tận dụng: 6 chuyên khoa + 6 bác sĩ đã seed trên Neon, Dashboard đặt lịch đã có.

## Đề xuất: làm theo 2 lớp — rules trước, LLM sau (không cần key để bắt đầu)

Lớp rules chạy được ngay, không tốn tiền, không cần key, không phụ thuộc mạng ngoài.
Lớp LLM (OpenAI hoặc Gemini) chỉ là lớp nâng cao đặt lên trên; khi chưa có key hoặc
LLM lỗi thì tự rơi về rules. Như vậy triage vẫn demo/test được trong khi chờ quyết định key.

### Hướng A — Rules-only trước (khuyên làm trước)
- Không cần key, không thêm dependency, không thêm chi phí.
- Đủ để chứng minh luồng: nhập triệu chứng → gợi ý chuyên khoa + bác sĩ → bấm là lọc Dashboard.
- Hạn chế thật: chỉ khớp từ khóa, không hiểu câu diễn đạt lạ; cần ghi rõ là gợi ý sơ bộ.

### Hướng B — Thêm LLM sau khi có key
- OpenAI hoặc Gemini, key đặt làm biến môi trường trên Render (`OPENAI_API_KEY` /
  `GEMINI_API_KEY`), không gửi key qua chat, không commit vào repo.
- LLM chỉ gợi ý chuyên khoa / mức ưu tiên / câu hỏi thêm — không chẩn đoán, không kê đơn.
- Nếu LLM không trả về chuyên khoa hợp lệ trong 6 chuyên khoa đã có thì rơi về rules.

## API đề xuất (chưa code)

`POST /api/v1/triage` — không cần đăng nhập để thử, nhưng khi gắn vào Dashboard thì
gợi ý sẽ lọc đúng bác sĩ đang có.

Request:
```json
{ "symptoms": "đau răng, sưng lợi 2 ngày", "age": 30, "duration_days": 2 }
```

Response:
```json
{
  "specialty": { "id": 3, "name": "Răng hàm mặt" },
  "doctors": [{ "id": 3, "name": "BS. Lê Minh Châu" }],
  "priority": "routine",
  "follow_up_questions": ["Đau tăng khi ăn nóng/lạnh không?", "Có sốt không?"],
  "reason": "Khớp từ khóa: đau răng, sưng lợi",
  "source": "rules",
  "disclaimer": "Đây chỉ là gợi ý sàng lọc sơ bộ, không thay thế chẩn đoán của bác sĩ. Nếu có dấu hiệu nguy hiểm, hãy đi cấp cứu ngay."
}
```

`priority` chỉ có 3 giá trị: `routine` (khám thường) / `urgent` (khám gấp trong ngày)
 / `emergency` (đi cấp cứu — không đặt lịch thường).

## Bảng mapping rules → 6 chuyên khoa đã seed

Dùng tên chuyên khoa/bác sĩ theo bản seed đã kiểm chứng qua test live ngày 26/10
(6 bác sĩ hiện đủ trên Dashboard) và id chuyên khoa đã xác nhận live ngày 28/10
~12:00 qua `GET /api/v1/doctors/specialties` (Render cold start ~45 giây rồi trả JSON):
id 1 Nội tổng quát, 2 Nhi khoa, 3 Răng hàm mặt, 4 Tim mạch, 5 Da liễu, 6 Mắt.
Id bác sĩ đã xác nhận live ngày 28/10 ~13:00 qua `GET /api/v1/doctors` (sau ~60 giây chờ Render Free cold start): 1 BS. Nguyễn Văn An (Nội tổng quát), 2 BS. Trần Thị Bình (Nhi khoa), 3 BS. Lê Minh Châu (Răng hàm mặt), 4 BS. Phạm Quốc Dũng (Tim mạch), 5 BS. Hoàng Thu Hà (Da liễu), 6 BS. Vũ Đức Khang (Mắt). Bảng mapping ở trên dùng đúng các id này.

| Triệu chứng (từ khóa tiếng Việt) | Chuyên khoa (id đã xác nhận live 28/10 ~12:00) | Bác sĩ gợi ý |
|---|---|---|
| sốt, ho, cảm, mệt, đau đầu, đau bụng, tiêu chảy | Nội tổng quát (id 1) | BS. Nguyễn Văn An |
| trẻ sốt, trẻ ho, trẻ biếng ăn, phát ban ở trẻ | Nhi khoa (id 2) | BS. Trần Thị Bình |
| đau răng, sưng lợi, sâu răng, chảy máu chân răng | Răng hàm mặt (id 3) | BS. Lê Minh Châu |
| đau ngực, hồi hộp, tim đập nhanh, huyết áp cao | Tim mạch (id 4) | BS. Phạm Quốc Dũng |
| nổi mẩn, ngứa, mụn, rụng tóc, nấm da | Da liễu (id 5) | BS. Hoàng Thu Hà |
| mờ mắt, đau mắt, đỏ mắt, chảy nước mắt | Mắt (id 6) | BS. Vũ Đức Khang |
| không khớp từ khóa nào | Nội tổng quát (id 1, mặc định, độ tin cậy thấp) | BS. Nguyễn Văn An |

## Dấu hiệu nguy hiểm → `emergency` (ưu tiên cao nhất, vượt mọi mapping)

Đau ngực dữ dội, khó thở, tím tái, yếu/liệt một bên người, nói khó, co giật,
chảy máu nhiều không cầm, đau bụng dữ dội kèm nôn ra máu, chấn thương đầu.
→ Trả `priority: "emergency"`, không gợi ý đặt lịch thường, hiển thị:
“Gọi cấp cứu 115 hoặc đến cơ sở y tế gần nhất ngay.”

## Câu hỏi thêm theo chuyên khoa (tối đa 3 câu, hỏi trước khi gợi ý cuối)

- Nội tổng quát: Sốt bao nhiêu độ? Triệu chứng mấy ngày rồi? Có bệnh nền / đang uống thuốc gì không?
- Nhi khoa: Bé mấy tuổi? Sốt bao nhiêu độ? Bé ăn/uống và chơi có bình thường không?
- Răng hàm mặt: Đau tăng khi ăn nóng/lạnh không? Có sưng mặt không? Có sốt không?
- Tim mạch: Đau ngực lan ra tay/lưng không? Có khó thở khi gắng sức không? Có tiền sử tim mạch/huyết áp không?
- Da liễu: Tổn thương ở đâu, bao lâu rồi? Có ngứa/rát không? Có dùng thuốc/kem gì chưa?
- Mắt: Mắt nào bị? Nhìn mờ đột ngột hay từ từ? Có chấn thương mắt không?

## 8 ca test để kiểm chứng (chạy bằng tay, không cần UI)

1. “đau răng, sưng lợi 2 ngày” → Răng hàm mặt / BS. Lê Minh Châu / routine
2. “bé 3 tuổi sốt 38.5, ho” → Nhi khoa / BS. Trần Thị Bình / routine (hỏi thêm tuổi + nhiệt độ)
3. “đau ngực, khó thở” → Tim mạch / BS. Phạm Quốc Dũng / **emergency**
4. “nổi mẩn ngứa khắp người” → Da liễu / BS. Hoàng Thu Hà / routine
5. “mắt mờ, đỏ mắt” → Mắt / BS. Vũ Đức Khang / routine
6. “sốt, ho 3 ngày” → Nội tổng quát / BS. Nguyễn Văn An / routine
7. “đau đầu, mệt” → Nội tổng quát / BS. Nguyễn Văn An / routine, độ tin cậy thấp
8. “yếu một bên người, nói khó” → **emergency**, không đặt lịch thường

## Gắn vào Dashboard như thế nào

- Thêm ô “Mô tả triệu chứng” trên Dashboard, nút “Gợi ý bác sĩ”.
- Kết quả hiện chuyên khoa + bác sĩ gợi ý, bấm vào là lọc Dashboard theo chuyên khoa đó
  (dùng đúng filter `specialty_id` đã có, không làm lại).
- Disclaimer luôn hiện dưới kết quả, chữ nhỏ nhưng rõ (xem Response mẫu ở trên).
- Không lưu triệu chứng vào DB ở bản đầu — chỉ gợi ý rồi đặt lịch như hiện tại.

## Anh chỉ cần quyết 2 việc

1. Làm rules trước (Hướng A) hay chờ có key rồi làm LLM luôn?
2. Nếu làm LLM: OpenAI hay Gemini — và key sẽ cấp qua biến môi trường Render
   (em sẽ hướng dẫn đặt trên Render, không cần gửi key qua chat).

## Đã làm (Hướng A, 28/10/2026) / chưa xác nhận

- Đã code endpoint `POST /api/v1/triage`, đã sửa `ai_triage.py` thành rules,
  đã gắn ô triệu chứng + nút "Gợi ý bác sĩ" vào Dashboard (lọc theo
  `specialty_id`, disclaimer luôn hiện). Chưa thêm dependency LLM.
- Đã xác nhận live 28/10 ~13:00: `GET /api/v1/doctors` trả đủ 6 bác sĩ với id 1–6 khớp chuyên khoa 1–6 (xem bảng mapping ở trên); `GET /api/v1/doctors/specialties` đã xác nhận live 28/10 ~12:00 với id 1–6 như bảng trên (sau ~45 giây chờ Render Free cold start).
- Chưa xác nhận trên web live sau deploy: cần kiểm tra `POST /api/v1/triage`
  live và bundle JS mới trên Vercel sau khi push.
