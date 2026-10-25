# MediBook AI — Đặt lịch khám bệnh tích hợp AI

Hệ thống đặt lịch khám bệnh: bệnh nhân tìm bác sĩ, đặt lịch theo thời gian thực,
AI sàng lọc triệu chứng và gợi ý chuyên khoa. Phòng khám quản lý lịch, giảm no-show.

## Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS — deploy Vercel
- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic — deploy Render
- **Database:** Neon Postgres (PostgreSQL + pgvector)
- **AI:** OpenAI / Gemini API (triage, gợi ý chuyên khoa, tóm tắt hồ sơ)

## Cấu trúc
```
medibook-ai/
├── backend/   # FastAPI
├── frontend/  # React + Vite + Tailwind
├── docs/      # PRD, API spec
└── render.yaml
```

## Chạy local
```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # điền DATABASE_URL của Neon
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5173
```

API docs: http://localhost:8000/docs
