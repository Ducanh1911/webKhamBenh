import { useEffect, useState } from 'react'
import { getToken, clearToken, getMe, type Me } from './lib/api'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import Dashboard from './pages/Dashboard'
import AdminPage from './pages/Admin'
import SuccessPopup from './components/SuccessPopup'

export default function App() {
  const [authed, setAuthed] = useState(!!getToken())
  const [view, setView] = useState<'login' | 'register'>('login')
  const [me, setMe] = useState<Me | null>(null)
  const [meLoading, setMeLoading] = useState(false)
  const [authNotice, setAuthNotice] = useState('')

  useEffect(() => {
    if (!authed) { setMe(null); setMeLoading(false); return }
    setMeLoading(true)
    getMe().then(setMe).catch(() => setMe(null)).finally(() => setMeLoading(false))
  }, [authed])

  function logout() {
    clearToken()
    setAuthed(false)
    setMe(null)
    setMeLoading(false)
    setAuthNotice('')
  }

  if (authed) {
    // Tách biệt hoàn toàn: admin chỉ vào trang Quản trị, không vào được
    // trang đặt lịch, kể cả lúc đang tải thông tin tài khoản cũng không
    // hiện Dashboard thoáng qua.
    if (meLoading) {
      return <div className="min-h-screen flex items-center justify-center text-ink-500 text-sm">Đang tải…</div>
    }
    if (me?.role === 'admin') {
      return (
        <>
          <AdminPage onLogout={logout} onClearAuthNotice={() => setAuthNotice('')} />
          {authNotice && <SuccessPopup message={authNotice} onClose={() => setAuthNotice('')} />}
        </>
      )
    }
    return (
      <>
        <Dashboard onLogout={logout} onClearAuthNotice={() => setAuthNotice('')} />
        {authNotice && <SuccessPopup message={authNotice} onClose={() => setAuthNotice('')} />}
      </>
    )
  }
  if (view === 'register') return <RegisterPage onSuccess={() => { setAuthNotice('Đăng ký thành công.'); setAuthed(true) }} onGoLogin={() => setView('login')} />
  return <LoginPage onSuccess={() => { setAuthNotice('Đăng nhập thành công.'); setAuthed(true) }} onGoRegister={() => setView('register')} />
}
