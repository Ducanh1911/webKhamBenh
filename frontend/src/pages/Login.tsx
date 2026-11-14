import { useCallback, useState } from 'react'
import { login, forgotPassword } from '../lib/api'
import ErrorPopup from '../components/ErrorPopup'

export default function LoginPage({ onSuccess, onGoRegister }: { onSuccess: () => void; onGoRegister: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showForgot, setShowForgot] = useState(false)
  const [error, setError] = useState('')
  const dismissError = useCallback(() => setError(''), [])
  const [loading, setLoading] = useState(false)
  // Form đặt lại mật khẩu (không cần đăng nhập): email + mật khẩu cũ +
  // mật khẩu mới; chỉ khi mật khẩu cũ đúng mới cho đổi.
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotCurrent, setForgotCurrent] = useState('')
  const [forgotNew, setForgotNew] = useState('')
  const [forgotConfirm, setForgotConfirm] = useState('')
  const [forgotFormError, setForgotFormError] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotDone, setForgotDone] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password, remember)
      onSuccess()
    } catch {
      setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault()
    if (!forgotCurrent) { setForgotFormError('Vui lòng nhập mật khẩu cũ.'); return }
    if (forgotNew.length < 6) { setForgotFormError('Mật khẩu mới phải có ít nhất 6 ký tự.'); return }
    if (forgotNew === forgotCurrent) { setForgotFormError('Mật khẩu mới phải khác mật khẩu cũ.'); return }
    if (forgotNew !== forgotConfirm) { setForgotFormError('Mật khẩu nhập lại chưa khớp với mật khẩu mới.'); return }
    setForgotLoading(true)
    setForgotFormError('')
    setError('')
    try {
      const data = await forgotPassword(forgotEmail.trim(), forgotCurrent, forgotNew)
      setForgotDone(data.message || 'Đã đặt lại mật khẩu, mời đăng nhập bằng mật khẩu mới.')
      setEmail(forgotEmail.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt lại mật khẩu không thành công.')
    } finally {
      setForgotLoading(false)
    }
  }

  function openForgot() {
    setForgotEmail(email)
    setShowForgot(true)
    setError('')
    setForgotDone('')
    setForgotFormError('')
    setForgotCurrent('')
    setForgotNew('')
    setForgotConfirm('')
  }

  function backToLogin() {
    setShowForgot(false)
    setForgotDone('')
    setForgotFormError('')
    setForgotCurrent('')
    setForgotNew('')
    setForgotConfirm('')
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left — thương hiệu, tông teal trầm, không gradient tím/xanh AI */}
      <aside className="hidden lg:flex flex-col justify-between bg-brand-900 text-white p-10 xl:p-14">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-lg font-bold">M</div>
          <span className="font-semibold text-lg tracking-tight">MediBook AI</span>
        </div>

        <div>
          <p className="text-[13px] font-medium tracking-wide text-teal-200 uppercase">Hệ thống đặt lịch khám bệnh</p>
          <h1 className="mt-4 text-[34px] leading-[1.15] font-semibold tracking-tight max-w-md">
            Đặt lịch khám đúng bác sĩ, đúng giờ.
          </h1>
          <p className="mt-4 text-teal-100/90 text-[15px] leading-relaxed max-w-md">
            Tìm bác sĩ theo chuyên khoa, xem lịch trống theo thời gian thực
            và nhận nhắc lịch tự động trước giờ khám.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6 max-w-md border-t border-white/15 pt-6">
            <div><dt className="text-2xl font-semibold">2.400+</dt><dd className="text-[13px] text-teal-100/80 mt-1">Bác sĩ đối tác</dd></div>
            <div><dt className="text-2xl font-semibold">98%</dt><dd className="text-[13px] text-teal-100/80 mt-1">Lịch đúng hẹn</dd></div>
            <div><dt className="text-2xl font-semibold">4.8/5</dt><dd className="text-[13px] text-teal-100/80 mt-1">Đánh giá hài lòng</dd></div>
          </dl>
        </div>

        <p className="text-[13px] text-teal-100/70">Thông tin sức khỏe của bạn được bảo mật theo chuẩn y tế.</p>
      </aside>

      {/* Right — form đăng nhập */}
      <main className="flex items-center justify-center px-6 py-12 bg-[#f7f8f7]">
        <div className="w-full max-w-[420px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-brand-700 text-white flex items-center justify-center font-bold">M</div>
            <span className="font-semibold text-lg">MediBook AI</span>
          </div>

          <h2 className="text-[26px] font-semibold tracking-tight text-ink-900">{showForgot ? 'Đặt lại mật khẩu' : 'Chào mừng trở lại'}</h2>
          <p className="text-ink-500 text-[15px] mt-1.5">{showForgot ? 'Nhập email đã đăng ký, mật khẩu cũ và mật khẩu mới của bạn.' : 'Đăng nhập để xem lịch khám và hồ sơ của bạn.'}</p>

          {showForgot ? (
          <form onSubmit={submitForgot} className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-card">
            {error && <ErrorPopup message={error} onClose={dismissError} />}
            {forgotDone ? (
              <>
                <p className="rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm px-3.5 py-2.5">{forgotDone}</p>
                <button
                  type="button" onClick={backToLogin}
                  className="mt-5 w-full h-11 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-[15px] font-medium transition"
                >
                  Quay lại đăng nhập
                </button>
              </>
            ) : (
              <>
                {forgotFormError && <p className="rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm px-3.5 py-2.5">{forgotFormError}</p>}

                <label className="block">
                  <span className="text-sm font-medium text-ink-900">Email đã đăng ký</span>
                  <input
                    type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    placeholder="ban@example.com" autoComplete="email"
                    className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 transition"
                  />
                </label>

                <label className="block mt-5">
                  <span className="text-sm font-medium text-ink-900">Mật khẩu cũ</span>
                  <input
                    type="password" required value={forgotCurrent} onChange={e => setForgotCurrent(e.target.value)}
                    placeholder="Nhập mật khẩu cũ" autoComplete="current-password"
                    className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 transition"
                  />
                </label>

                <label className="block mt-5">
                  <span className="text-sm font-medium text-ink-900">Mật khẩu mới</span>
                  <input
                    type="password" required value={forgotNew} onChange={e => setForgotNew(e.target.value)}
                    placeholder="Ít nhất 6 ký tự" autoComplete="new-password"
                    className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 transition"
                  />
                </label>

                <label className="block mt-5">
                  <span className="text-sm font-medium text-ink-900">Nhập lại mật khẩu mới</span>
                  <input
                    type="password" required value={forgotConfirm} onChange={e => setForgotConfirm(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới" autoComplete="new-password"
                    className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 transition"
                  />
                </label>

                <button
                  type="submit" disabled={forgotLoading}
                  className="mt-6 w-full h-11 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-[15px] font-medium transition"
                >
                  {forgotLoading ? 'Đang đặt lại…' : 'Đặt lại mật khẩu'}
                </button>

                <p className="mt-5 text-center text-sm text-ink-500">
                  Nhớ lại mật khẩu?{' '}
                  <button type="button" onClick={backToLogin} className="font-medium text-brand-700 hover:text-brand-800">Quay lại đăng nhập</button>
                </p>
              </>
            )}
          </form>
          ) : (
          <form onSubmit={submit} className="mt-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-card">
            {error && <ErrorPopup message={error} onClose={dismissError} />}

            <label className="block">
              <span className="text-sm font-medium text-ink-900">Email</span>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ban@example.com" autoComplete="email"
                className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 transition"
              />
            </label>

            <label className="block mt-5">
              <span className="text-sm font-medium text-ink-900">Mật khẩu</span>
              <input
                type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 transition"
              />
            </label>

            <div className="mt-4 flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink-700 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="w-4 h-4 accent-brand-700 rounded" /> Ghi nhớ đăng nhập
              </label>
              <button type="button" onClick={openForgot} className="font-medium text-brand-700 hover:text-brand-800">Quên mật khẩu?</button>
            </div>

            <button
              type="submit" disabled={loading}
              className="mt-6 w-full h-11 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-[15px] font-medium transition"
            >
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>

            <p className="mt-5 text-center text-sm text-ink-500">
              Chưa có tài khoản?{' '}
              <button type="button" onClick={onGoRegister} className="font-medium text-brand-700 hover:text-brand-800">Đăng ký miễn phí</button>
            </p>
          </form>
          )}

          <p className="mt-6 text-center text-xs leading-relaxed text-ink-500">
            Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách bảo mật của MediBook AI.
          </p>
        </div>
      </main>
    </div>
  )
}
