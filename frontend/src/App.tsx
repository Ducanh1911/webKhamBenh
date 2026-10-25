import { useState } from 'react'
import { getToken, clearToken } from './lib/api'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [authed, setAuthed] = useState(!!getToken())
  const [view, setView] = useState<'login' | 'register'>('login')
  if (authed) return <Dashboard onLogout={() => { clearToken(); setAuthed(false) }} />
  if (view === 'register') return <RegisterPage onSuccess={() => setAuthed(true)} onGoLogin={() => setView('login')} />
  return <LoginPage onSuccess={() => setAuthed(true)} onGoRegister={() => setView('register')} />
}
