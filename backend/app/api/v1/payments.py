import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_non_admin
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from app.services import momo

router = APIRouter()


class PaymentOut(BaseModel):
    id: int
    appointment_id: int
    order_id: str
    amount: int
    status: str
    pay_url: str | None = None
    trans_id: int | None = None
    result_code: int | None = None


def _out(p: Payment) -> PaymentOut:
    return PaymentOut(
        id=p.id,
        appointment_id=p.appointment_id,
        order_id=p.order_id,
        amount=p.amount,
        status=p.status.value,
        pay_url=p.pay_url,
        trans_id=p.trans_id,
        result_code=p.result_code,
    )


# --- Chẩn đoán TẠM THỜI (gỡ sau khi kiểm tra xong, không phải API sản phẩm) ---
# Kiểm tra sandbox VNPay có tới được từ máy chủ Render không. Từ máy phát
# triển và từ Vercel đều timeout sau ~10s (3 lần: 5/11, 6/11, 10/11), nên
# chỉ tuyến Render mới quyết định được hướng VNPay có khả thi hay không.
_VNPAY_PING_URLS = [
    "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    "https://sandbox.vnpayment.vn/",
]
_VNPAY_PING_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


@router.get("/payments/vnpay-ping")
def vnpay_ping():
    """GET thử 2 đường dẫn sandbox VNPay, trả về mã HTTP hoặc lỗi + thời gian."""
    results = []
    for url in _VNPAY_PING_URLS:
        start = time.monotonic()
        try:
            with httpx.Client(timeout=12.0, follow_redirects=True) as client:
                r = client.get(url, headers={"User-Agent": _VNPAY_PING_UA})
            results.append({
                "url": url,
                "ok": True,
                "status": r.status_code,
                "elapsed_s": round(time.monotonic() - start, 2),
            })
        except Exception as e:  # timeout / lỗi kết nối: ghi lại, không 500
            results.append({
                "url": url,
                "ok": False,
                "error": type(e).__name__,
                "detail": str(e)[:200],
                "elapsed_s": round(time.monotonic() - start, 2),
            })
    return {"service": "vnpay-ping", "results": results}


def _apply_success(db: Session, payment: Payment, trans_id: int | None, result_code: int):
    """Ghi nhận thanh toán thành công. Idempotent: gọi lại không đổi gì.

    Chỉ lịch đang chờ xác nhận mới được chuyển sang đã xác nhận.
    Lịch đã hủy / đã khám xong không bị hồi sinh bởi một IPN tới muộn.
    """
    if payment.status == PaymentStatus.SUCCESS:
        return
    payment.status = PaymentStatus.SUCCESS
    payment.trans_id = trans_id
    payment.result_code = result_code
    appt = db.query(Appointment).filter(Appointment.id == payment.appointment_id).first()
    if appt is not None and appt.status == AppointmentStatus.PENDING:
        appt.status = AppointmentStatus.CONFIRMED
    db.commit()


def _apply_failure(db: Session, payment: Payment, result_code: int):
    if payment.status == PaymentStatus.SUCCESS:
        return
    payment.status = PaymentStatus.FAILED
    payment.result_code = result_code
    db.commit()


def _ipn_url() -> str:
    if settings.MOMO_IPN_URL:
        return settings.MOMO_IPN_URL
    backend = settings.BACKEND_URL or "https://medibook-ai-api.onrender.com"
    return f"{backend.rstrip('/')}/api/v1/payments/ipn"


@router.post("/appointments/{appointment_id}/payments", response_model=PaymentOut, status_code=201)
def create_appointment_payment(
    appointment_id: int,
    user: User = Depends(get_current_non_admin),
    db: Session = Depends(get_db),
):
    if not momo.configured():
        raise HTTPException(
            status_code=503,
            detail="Chưa cấu hình MoMo sandbox (MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY)",
        )
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id, Appointment.patient_id == user.id
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch hẹn")
    if appt.status != AppointmentStatus.PENDING:
        raise HTTPException(
            status_code=400, detail="Chỉ lịch đang chờ xác nhận mới thanh toán được"
        )
    doctor = db.query(Doctor).filter(Doctor.id == appt.doctor_id).first()
    amount = doctor.consultation_fee if doctor else 0
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Bác sĩ này chưa có phí khám để thanh toán")

    existing = (
        db.query(Payment)
        .filter(Payment.appointment_id == appt.id)
        .order_by(Payment.id.desc())
        .first()
    )
    if existing and existing.status == PaymentStatus.SUCCESS:
        raise HTTPException(status_code=400, detail="Lịch hẹn này đã thanh toán rồi")
    if existing and existing.status == PaymentStatus.PENDING and existing.pay_url:
        # Tránh tạo nhiều đơn MoMo trùng nhau khi người dùng bấm lại.
        return _out(existing)

    ipn_url = _ipn_url()
    if not ipn_url:
        raise HTTPException(
            status_code=503, detail="Chưa cấu hình BACKEND_URL hoặc MOMO_IPN_URL để MoMo gửi IPN"
        )
    order_id = f"MB{appt.id}-{int(time.time())}"
    request_id = order_id
    redirect_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/"
        f"?payment_return=1&appointment_id={appt.id}&order_id={order_id}"
    )
    extra_data = momo.extra_data_for_appointment(appt.id)
    try:
        result = momo.create_payment(
            order_id=order_id,
            request_id=request_id,
            amount=amount,
            order_info=f"Thanh toan lich hen MediBook AI #{appt.id}",
            redirect_url=redirect_url,
            ipn_url=ipn_url,
            extra_data=extra_data,
        )
    except momo.MoMoHttpError as e:
        raise HTTPException(
            status_code=502,
            detail=f"MoMo sandbox trả HTTP {e.status_code} — có thể máy chủ Render bị MoMo chặn, vui lòng thử lại sau",
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=502, detail="MoMo sandbox phản hồi quá chậm (hết 60 giây), vui lòng thử lại"
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Không kết nối được tới MoMo sandbox")
    if result.get("resultCode") != 0 or not result.get("payUrl"):
        raise HTTPException(
            status_code=502,
            detail=f"MoMo từ chối tạo đơn: {result.get('message') or result.get('resultCode')}",
        )
    payment = Payment(
        appointment_id=appt.id,
        order_id=order_id,
        request_id=request_id,
        amount=amount,
        status=PaymentStatus.PENDING,
        pay_url=result["payUrl"],
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return _out(payment)


@router.post("/payments/{payment_id}/check", response_model=PaymentOut)
def check_payment(
    payment_id: int,
    user: User = Depends(get_current_non_admin),
    db: Session = Depends(get_db),
):
    """Kiểm tra lại với MoMo khi người dùng trở về từ trang thanh toán.

    Đây là server-to-server, không tin vào query string trên URL redirect.
    IPN vẫn là kênh chính; endpoint này chỉ là dự phòng khi IPN tới chậm
    hoặc Render đang ngủ lúc MoMo gửi IPN.
    """
    if not momo.configured():
        raise HTTPException(status_code=503, detail="Chưa cấu hình MoMo sandbox")
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")
    appt = db.query(Appointment).filter(Appointment.id == payment.appointment_id).first()
    if not appt or appt.patient_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")
    if payment.status == PaymentStatus.SUCCESS:
        return _out(payment)
    try:
        result = momo.query_payment(payment.order_id, payment.request_id)
    except momo.MoMoHttpError as e:
        raise HTTPException(
            status_code=502, detail=f"MoMo sandbox trả HTTP {e.status_code}"
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Không kết nối được tới MoMo sandbox")
    result_code = result.get("resultCode")
    if result_code == 0:
        # Chỉ xác nhận khi chữ ký, số tiền và mã giao dịch đều khớp.
        if result.get("signature") and not momo.verify_result_signature(result):
            raise HTTPException(status_code=502, detail="Chữ ký kết quả MoMo không hợp lệ")
        if result.get("amount") is not None and int(result["amount"]) != payment.amount:
            raise HTTPException(status_code=502, detail="Số tiền MoMo trả về không khớp")
        trans_id = result.get("transId")
        _apply_success(db, payment, int(trans_id) if trans_id else None, 0)
        db.refresh(payment)
        return _out(payment)
    if result_code == 1006:
        # Người dùng hủy thanh toán trên MoMo: cho phép tạo đơn mới.
        _apply_failure(db, payment, 1006)
        db.refresh(payment)
    return _out(payment)


@router.post("/payments/ipn")
async def momo_ipn(request: Request, db: Session = Depends(get_db)):
    """IPN server-to-server của MoMo. Không cần JWT vì MoMo gọi trực tiếp.

    Không bao giờ xác nhận chỉ vì resultCode=0: phải khớp chữ ký,
    partnerCode, orderId, số tiền và appointment_id trong extraData.
    """
    payload = await request.json()
    if not momo.configured():
        raise HTTPException(status_code=503, detail="Chưa cấu hình MoMo sandbox")
    if payload.get("partnerCode") != settings.MOMO_PARTNER_CODE:
        raise HTTPException(status_code=400, detail="partnerCode không khớp")
    if not momo.verify_result_signature(payload):
        raise HTTPException(status_code=400, detail="Chữ ký IPN không hợp lệ")
    payment = db.query(Payment).filter(Payment.order_id == payload.get("orderId")).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Không tìm thấy giao dịch")
    if payload.get("amount") is not None and int(payload["amount"]) != payment.amount:
        raise HTTPException(status_code=400, detail="Số tiền IPN không khớp")
    extra_appointment = momo.appointment_id_from_extra_data(payload.get("extraData") or "")
    if extra_appointment is not None and extra_appointment != payment.appointment_id:
        raise HTTPException(status_code=400, detail="extraData không khớp lịch hẹn")
    result_code = int(payload.get("resultCode", -1))
    trans_id = payload.get("transId")
    if result_code == 0:
        _apply_success(db, payment, int(trans_id) if trans_id else None, 0)
    else:
        _apply_failure(db, payment, result_code)
    return {"ok": True}
