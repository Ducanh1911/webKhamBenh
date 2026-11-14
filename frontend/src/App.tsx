import { useEffect, useState } from 'react'
import { getToken, clearToken, getMe, type Me } from './lib/api'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import Dashboard from './pages/Dashboard'
import AdminPage from './pages/Admin'
import DoctorPage from './pages/Doctor'
import SuccessPopup from './components/SuccessPopup'
import ChatWidget from './components/ChatWidget'

export default function App() {
  const [authed, setAuthed] = useState(!!getToken())
  const [view, setView] = useState<'login' | 'register'>('login')
  const [me, setMe] = useState<Me | null>(null)
  const [meLoading, setMeLoading] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  // Bác sĩ chờ đặt lịch khi bấm "Đặt lịch" trong gợi ý chatbot. Giữ lại
  // cả khi chưa đăng nhập để đăng nhập xong Dashboard mở modal luôn.
  const [bookDoctorId, setBookDoctorId] = useState<number | null>(null)

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
    setBookDoctorId(null)
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
          <ChatWidget />
        </>
      )
    }
    // Bác sĩ cũng tách biệt hoàn toàn: chỉ vào trang Bác sĩ, không vào
    // được trang đặt lịch. So sánh không phân biệt hoa/thường vì role
    // trong DB còn sót dạng chữ hoa.
    if (me?.role?.toLowerCase() === 'doctor') {
      return (
        <>
          <DoctorPage onLogout={logout} onClearAuthNotice={() => setAuthNotice('')} />
          {authNotice && <SuccessPopup message={authNotice} onClose={() => setAuthNotice('')} />}
          <ChatWidget />
        </>
      )
    }
    return (
      <>
        <Dashboard onLogout={logout} onClearAuthNotice={() => setAuthNotice('')} bookDoctorId={bookDoctorId} onBookDoctorHandled={() => setBookDoctorId(null)} />
        {authNotice && <SuccessPopup message={authNotice} onClose={() => setAuthNotice('')} />}
        <ChatWidget onBookDoctor={setBookDoctorId} />
      </>
    )
  }
  if (view === 'register') return (
    <>
      <RegisterPage onSuccess={() => { setAuthNotice('Đăng ký thành công.'); setAuthed(true) }} onGoLogin={() => setView('login')} />
      <ChatWidget onBookDoctor={setBookDoctorId} />
    </>
  )
  return (
    <>
      <LoginPage onSuccess={() => { setAuthNotice('Đăng nhập thành công.'); setAuthed(true) }} onGoRegister={() => setView('register')} />
      <ChatWidget onBookDoctor={setBookDoctorId} />
    </>
  )
}
