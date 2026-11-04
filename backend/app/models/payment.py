import enum
from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"


class Payment(Base):
    """Một lần thanh toán MoMo cho một lịch hẹn.

    Chỉ IPN (server-to-server, đã xác thực chữ ký) và kiểm tra lại bằng
    API query của MoMo mới được đổi trạng thái. Redirect từ trình duyệt
    của người dùng không bao giờ tự đổi trạng thái, vì URL đó có thể
    bị giả mạo.
    """

    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(ForeignKey("appointments.id"))
    order_id: Mapped[str] = mapped_column(String(200), unique=True)
    request_id: Mapped[str] = mapped_column(String(200))
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.PENDING
    )
    trans_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pay_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
