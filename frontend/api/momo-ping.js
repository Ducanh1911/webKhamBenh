// Hàm chẩn đoán tạm thời: gọi thử MoMo sandbox và VNPay sandbox từ IP
// của Vercel để xem cổng nào qua được từ máy chủ. Không chứa key,
// không tạo đơn thật, chỉ gửi payload rỗng để xem mã HTTP.
async function ping(url, options) {
  const started = Date.now()
  try {
    const r = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) })
    const text = await r.text()
    return { http_status: r.status, elapsed_ms: Date.now() - started, snippet: text.slice(0, 200) }
  } catch (e) {
    return { http_status: null, error: String(e && e.message ? e.message : e), elapsed_ms: Date.now() - started }
  }
}

export default async function handler(req, res) {
  const momo = await ping('https://test-payment.momo.vn/v2/gateway/api/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ partnerCode: 'ping' }),
  })
  const vnpay = await ping('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html', { method: 'GET' })
  res.status(200).json({ ok: true, momo, vnpay })
}
