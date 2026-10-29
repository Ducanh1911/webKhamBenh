import { useEffect, useState } from 'react'
import { getToken, clearToken, getMe, type Me } from './lib/api'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import Dashboard from './pages/Dashboard'
import AdminPage from './pages/Admin'

export default function App() {
  const [authed, setAuthed] = useState(!!getToken())
  const [view, setView] = useState<'login' | 'register'>('login')
  const [me, setMe] = useState<Me | null>(null)
  const [page, setPage] = useState<'booking' | 'admin'>('booking')

  useEffect(() => {
    if (!authed) { setMe(null); setPage('booking'); return }
    getMe().then(setMe).catch(() => setMe(null))
  }, [authed])

  function logout() {
    clearToken()
    setAuthed(false)
    setMe(null)
    setPage('booking')
  }

  if (authed) {
    if (page === 'admin' && me?.role === 'admin') {
      return <AdminPage onLogout={logout} onGoBooking={() => setPage('booking')} />
    }
    return <Dashboard onLogout={logout} isAdmin={me?.role === 'admin'} onGoAdmin={() => setPage('admin')} />
  }
  if (view === 'register') return <RegisterPage onSuccess={() => setAuthed(true)} onGoLogin={() => setView('login')} />
  return <LoginPage onSuccess={() => setAuthed(true)} onGoRegister={() => setView('register')} />
}
