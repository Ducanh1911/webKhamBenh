// Hàm chẩn đoán tạm thời: gọi thử MoMo sandbox từ IP của Vercel để
// xem MoMo có chặn IP máy chủ Vercel như đã chặn Render hay không.
// Không chứa key, không tạo đơn thật, chỉ gửi payload rỗng để xem mã HTTP.
export default async function handler(req, res) {
  const started = Date.now()
  try {
    const r = await fetch('https://test-payment.momo.vn/v2/gateway/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ partnerCode: 'ping' }),
      signal: AbortSignal.timeout(30000),
    })
    const text = await r.text()
    res.status(200).json({
      ok: true,
      momo_http_status: r.status,
      elapsed_ms: Date.now() - started,
      momo_body_snippet: text.slice(0, 300),
    })
  } catch (e) {
    res.status(200).json({
      ok: false,
      error: String(e && e.message ? e.message : e),
      elapsed_ms: Date.now() - started,
    })
  }
}
