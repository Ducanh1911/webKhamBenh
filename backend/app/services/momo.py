"""Tích hợp MoMo sandbox (ví điện tử, requestType=captureWallet).

Tài liệu: developers.momo.vn — One-Time Payments.
Chữ ký HMAC-SHA256, các trường xếp theo thứ tự a-z đúng như tài liệu:

- Tạo đơn:  accessKey, amount, extraData, ipnUrl, orderId, orderInfo,
  partnerCode, redirectUrl, requestId, requestType
- IPN / kết quả query: accessKey, amount, extraData, message, orderId,
  orderInfo, orderType, partnerCode, payType, requestId, responseTime,
  resultCode, transId

Không hard-code key trong code: lấy từ biến môi trường MOMO_*.
Sandbox MoMo dùng key test do chính tài khoản sandbox của anh cấp.
"""

import base64
import hashlib
import hmac
import json

import httpx

from app.core.config import settings


def _hmac_sha256(secret: str, raw: str) -> str:
    return hmac.new(
        secret.encode("utf-8"), raw.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def create_signature(
    amount: int,
    extra_data: str,
    ipn_url: str,
    order_id: str,
    order_info: str,
    redirect_url: str,
    request_id: str,
) -> str:
    raw = (
        f"accessKey={settings.MOMO_ACCESS_KEY}"
        f"&amount={amount}"
        f"&extraData={extra_data}"
        f"&ipnUrl={ipn_url}"
        f"&orderId={order_id}"
        f"&orderInfo={order_info}"
        f"&partnerCode={settings.MOMO_PARTNER_CODE}"
        f"&redirectUrl={redirect_url}"
        f"&requestId={request_id}"
        f"&requestType=captureWallet"
    )
    return _hmac_sha256(settings.MOMO_SECRET_KEY, raw)


def result_signature(payload: dict) -> str:
    """Chữ ký cho IPN và cho kết quả query, theo đúng format tài liệu."""
    raw = (
        f"accessKey={settings.MOMO_ACCESS_KEY}"
        f"&amount={payload.get('amount', '')}"
        f"&extraData={payload.get('extraData', '')}"
        f"&message={payload.get('message', '')}"
        f"&orderId={payload.get('orderId', '')}"
        f"&orderInfo={payload.get('orderInfo', '')}"
        f"&orderType={payload.get('orderType', '')}"
        f"&partnerCode={payload.get('partnerCode', '')}"
        f"&payType={payload.get('payType', '')}"
        f"&requestId={payload.get('requestId', '')}"
        f"&responseTime={payload.get('responseTime', '')}"
        f"&resultCode={payload.get('resultCode', '')}"
        f"&transId={payload.get('transId', '')}"
    )
    return _hmac_sha256(settings.MOMO_SECRET_KEY, raw)


def verify_result_signature(payload: dict) -> bool:
    signature = payload.get("signature")
    if not signature:
        return False
    return hmac.compare_digest(result_signature(payload), str(signature))


def query_signature(order_id: str, request_id: str) -> str:
    raw = (
        f"accessKey={settings.MOMO_ACCESS_KEY}"
        f"&orderId={order_id}"
        f"&partnerCode={settings.MOMO_PARTNER_CODE}"
        f"&requestId={request_id}"
    )
    return _hmac_sha256(settings.MOMO_SECRET_KEY, raw)


def extra_data_for_appointment(appointment_id: int) -> str:
    return base64.b64encode(
        json.dumps({"appointment_id": appointment_id}).encode("utf-8")
    ).decode("utf-8")


def appointment_id_from_extra_data(extra_data: str) -> int | None:
    try:
        data = json.loads(base64.b64decode(extra_data).decode("utf-8"))
        return int(data["appointment_id"])
    except Exception:
        return None


def configured() -> bool:
    return bool(
        settings.MOMO_PARTNER_CODE
        and settings.MOMO_ACCESS_KEY
        and settings.MOMO_SECRET_KEY
    )


# MoMo sandbox chặn cả developers.momo.vn lẫn test-payment.momo.vn
# bằng 403 nginx với các request server-side (kể cả khi gửi đủ header
# trình duyệt), nên lỗi HTTP phải được báo rõ mã trạng thái thay vì
# gộp chung thành "không kết nối được". Timeout 60s vì MoMo yêu cầu
# tối thiểu 30s và sandbox thỉnh thoảng phản hồi rất chậm.
_MOMO_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
}


class MoMoHttpError(Exception):
    def __init__(self, status_code: int):
        super().__init__(f"MoMo sandbox trả HTTP {status_code}")
        self.status_code = status_code


def _post(url: str, payload: dict) -> dict:
    with httpx.Client(timeout=60.0, headers=_MOMO_HEADERS) as client:
        res = client.post(url, json=payload)
        if res.status_code != 200:
            raise MoMoHttpError(res.status_code)
        return res.json()


def create_payment(
    order_id: str,
    request_id: str,
    amount: int,
    order_info: str,
    redirect_url: str,
    ipn_url: str,
    extra_data: str = "",
) -> dict:
    # extraData phải là đúng giá trị đã dùng để ký, nếu không IPN của
    # MoMo sẽ không khớp chữ ký. Caller truyền appointment_id qua đây.
    payload = {
        "partnerCode": settings.MOMO_PARTNER_CODE,
        "requestId": request_id,
        "amount": amount,
        "orderId": order_id,
        "orderInfo": order_info,
        "redirectUrl": redirect_url,
        "ipnUrl": ipn_url,
        "requestType": "captureWallet",
        "extraData": extra_data,
        "lang": "vi",
        "signature": create_signature(
            amount, extra_data, ipn_url, order_id, order_info, redirect_url, request_id
        ),
    }
    return _post(settings.MOMO_CREATE_URL, payload)


def query_payment(order_id: str, request_id: str) -> dict:
    payload = {
        "partnerCode": settings.MOMO_PARTNER_CODE,
        "requestId": request_id,
        "orderId": order_id,
        "lang": "vi",
        "signature": query_signature(order_id, request_id),
    }
    return _post(settings.MOMO_QUERY_URL, payload)
