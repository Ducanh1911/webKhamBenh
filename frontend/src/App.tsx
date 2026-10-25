import { useState } from 'react'
import LoginPage from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('token'))
  if (!authed) return <LoginPage onSuccess={() => setAuthed(true)} />
  return <Dashboard onLogout={() => { localStorage.removeItem('token'); setAuthed(false) }} />
}
