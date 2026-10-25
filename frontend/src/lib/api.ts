const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export function getToken(): string | null {
  return localStorage.getItem('token') ?? sessionStorage.getItem('token')
}
export function saveToken(token: string, remember: boolean) {
  if (remember) {
    localStorage.setItem('token', token)
    sessionStorage.removeItem('token')
  } else {
    sessionStorage.setItem('token', token)
    localStorage.removeItem('token')
  }
}
export function clearToken() {
  localStorage.removeItem('token')
  sessionStorage.removeItem('token')
}
function authHeaders(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}
async function handleError(res: Response, fallback: string): Promise<never> {
  const data = await res.json().catch(() => null)
  const detail = data?.detail
  throw new Error(typeof detail === 'string' ? detail : fallback)
}

export async function register(full_name: string, email: string, password: string, phone?: string) {
  const res = await fetch(`${API}/api/v1/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name, email, password, phone: phone || null }),
  })
  if (!res.ok) await handleError(res, 'Đăng ký không thành công, vui lòng thử lại')
  const data = await res.json()
  saveToken(data.access_token, true)
  return data
}

export async function login(email: string, password: string, remember = true) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Email hoặc mật khẩu không đúng')
  const data = await res.json()
  saveToken(data.access_token, remember)
  return data
}

export type Specialty = { id: number; name: string; description?: string | null }
export type Doctor = {
  id: number; name: string; specialty_id: number; specialty_name: string;
  clinic_name: string; years_experience: number; consultation_fee: number; bio?: string | null
}
export type Appointment = {
  id: number; doctor_id: number; doctor_name: string; specialty_name: string;
  clinic_name: string; start_at: string; reason?: string | null; status: string
}

export async function listSpecialties(): Promise<Specialty[]> {
  const res = await fetch(`${API}/api/v1/doctors/specialties`)
  if (!res.ok) throw new Error('Không tải được danh sách chuyên khoa')
  return (await res.json()).specialties
}
export async function listDoctors(specialtyId?: number): Promise<Doctor[]> {
  const q = specialtyId ? `?specialty_id=${specialtyId}` : ''
  const res = await fetch(`${API}/api/v1/doctors${q}`)
  if (!res.ok) throw new Error('Không tải được danh sách bác sĩ')
  return (await res.json()).doctors
}
export async function listMyAppointments(): Promise<Appointment[]> {
  const res = await fetch(`${API}/api/v1/appointments/mine`, { headers: authHeaders() })
  if (!res.ok) await handleError(res, 'Không tải được lịch hẹn của bạn')
  return res.json()
}
export async function createAppointment(doctorId: number, startAt: string, reason?: string): Promise<Appointment> {
  const res = await fetch(`${API}/api/v1/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ doctor_id: doctorId, start_at: startAt, reason: reason || null }),
  })
  if (!res.ok) await handleError(res, 'Đặt lịch không thành công, vui lòng thử lại')
  return res.json()
}
export async function cancelAppointment(id: number): Promise<Appointment> {
  const res = await fetch(`${API}/api/v1/appointments/${id}/cancel`, {
    method: 'POST', headers: authHeaders(),
  })
  if (!res.ok) await handleError(res, 'Hủy lịch không thành công')
  return res.json()
}
