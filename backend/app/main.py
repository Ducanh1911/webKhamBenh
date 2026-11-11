from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api.v1 import auth, doctors, appointments, triage, admin, payments, chat
import app.models  # noqa: F401  (đăng ký tất cả models để create_all thấy đủ bảng)

app = FastAPI(title="MediBook AI API", version="0.1.0", docs_url="/docs")


@app.on_event("startup")
def create_tables():
    # Idempotent: chỉ tạo bảng còn thiếu (ví dụ bảng payments mới),
    # không sửa bảng đã có. Nhờ vậy deploy Render không cần chạy tay
    # init_db cho bảng mới.
    Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(doctors.router, prefix="/api/v1/doctors", tags=["doctors"])
app.include_router(appointments.router, prefix="/api/v1/appointments", tags=["appointments"])
app.include_router(triage.router, prefix="/api/v1/triage", tags=["triage"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(payments.router, prefix="/api/v1", tags=["payments"])

@app.get("/health")
def health():
    return {"status": "ok", "service": "medibook-ai"}
