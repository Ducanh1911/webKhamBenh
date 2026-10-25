import { useState } from 'react'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'))
  const [view, setView] = useState<'login' | 'register'>('login')
  if (authed) return <Dashboard onLogout={() => { localStorage.removeItem('token'); setAuthed(false) }} />
  if (view === 'register') return <RegisterPage onSuccess={() => setAuthed(true)} onGoLogin={() => setView('login')} />
  return <LoginPage onSuccess={() => setAuthed(true)} onGoRegister={() => setView('register')} />
}
