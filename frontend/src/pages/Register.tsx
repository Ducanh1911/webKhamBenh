import { useState } from 'react'
import { register } from '../lib/api'

export default function RegisterPage({ onSuccess, onGoLogin }: { onSuccess: () => void; onGoLogin: () => void }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    if (password !== confirm) {
      setError('Mật khẩu nhập lại không khớp.')
      return
    }
    setLoading(true)
    try {
      await register(fullName.trim(), email.trim(), password, phone.trim() || undefined)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký không thành công, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "mt-1.5 w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 transition"

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <aside className="hidden lg:flex flex-col justify-between bg-brand-900 text-white p-10 xl:p-14">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-lg font-bold">M</div>
          <span className="font-semibold text-lg tracking-tight">MediBook AI</span>
        </div>
        <div>
          <p className="text-[13px] font-medium tracking-wide text-teal-200 uppercase">Hệ thống đặt lịch khám bệnh</p>
          <h1 className="mt-4 text-[34px] leading-[1.15] font-semibold tracking-tight max-w-md">
            Tạo tài khoản để đặt lịch khám trong vài phút.
          </h1>
          <p className="mt-4 text-teal-100/90 text-[15px] leading-relaxed max-w-md">
            Tìm bác sĩ theo chuyên khoa, xem lịch trống theo thời gian thực
            và nhận nhắc lịch tự động trước giờ khám.
          </p>
        </div>
        <p className="text-[13px] text-teal-100/70">Thông tin sức khỏe của bạn được bảo mật theo chuẩn y tế.</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 bg-[#f7f8f7]">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-brand-700 text-white flex items-center justify-center font-bold">M</div>
            <span className="font-semibold text-lg">MediBook AI</span>
          </div>

          <h2 className="text-[26px] font-semibold tracking-tight text-ink-900">Tạo tài khoản</h2>
          <p className="text-ink-500 text-[15px] mt-1.5">Đăng ký miễn phí, chỉ mất chưa tới một phút.</p>

          <form onSubmit={submit} className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-card">
            {error && (
              <p className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm px-3.5 py-2.5">{error}</p>
            )}

            <label className="block">
              <span className="text-sm font-medium text-ink-900">Họ và tên</span>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" className={inputCls} />
            </label>

            <label className="block mt-5">
              <span className="text-sm font-medium text-ink-900">Email</span>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@example.com" autoComplete="email" className={inputCls} />
            </label>

            <label className="block mt-5">
              <span className="text-sm font-medium text-ink-900">Số điện thoại <span className="text-ink-500 font-normal">(không bắt buộc)</span></span>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0901234567" autoComplete="tel" className={inputCls} />
            </label>

            <label className="block mt-5">
              <span className="text-sm font-medium text-ink-900">Mật khẩu</span>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Ít nhất 6 ký tự" autoComplete="new-password" className={inputCls} />
            </label>

            <label className="block mt-5">
              <span className="text-sm font-medium text-ink-900">Nhập lại mật khẩu</span>
              <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" className={inputCls} />
            </label>

            <button
              type="submit" disabled={loading}
              className="mt-6 w-full h-11 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-[15px] font-medium transition"
            >
              {loading ? 'Đang tạo tài khoản…' : 'Đăng ký tài khoản'}
            </button>

            <p className="mt-5 text-center text-sm text-ink-500">
              Đã có tài khoản?{' '}
              <button type="button" onClick={onGoLogin} className="font-medium text-brand-700 hover:text-brand-800">Đăng nhập</button>
            </p>
          </form>

          <p className="mt-6 text-center text-xs leading-relaxed text-ink-500">
            Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật của MediBook AI.
          </p>
        </div>
      </main>
    </div>
  )
}
