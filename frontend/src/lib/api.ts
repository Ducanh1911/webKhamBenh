const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
export async function login(email: string, password: string) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Email hoặc mật khẩu không đúng')
  const data = await res.json()
  localStorage.setItem('token', data.access_token)
  return data
}
