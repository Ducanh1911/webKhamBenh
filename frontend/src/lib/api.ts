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
export type DoctorPage = { doctors: Doctor[]; total: number; page: number; page_size: number; total_pages: number }
export async function listDoctors(specialtyId?: number, page = 1, pageSize = 6): Promise<DoctorPage> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (specialtyId) params.set('specialty_id', String(specialtyId))
  const res = await fetch(`${API}/api/v1/doctors?${params}`)
  if (!res.ok) throw new Error('Không tải được danh sách bác sĩ')
  return res.json()
}
export type TriageResult = {
  specialty: { id: number; name: string } | null
  doctors: { id: number; name: string }[]
  priority: string
  follow_up_questions: string[]
  reason: string
  confidence: string
  source: string
  disclaimer: string
}
export async function requestTriage(symptoms: string): Promise<TriageResult> {
  const res = await fetch(`${API}/api/v1/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symptoms }),
  })
  if (!res.ok) await handleError(res, 'Không gợi ý được bác sĩ, vui lòng thử lại')
  return res.json()
}
export type MyAppointmentsPage = { appointments: Appointment[]; total: number; page: number; page_size: number; total_pages: number }
export async function listMyAppointments(page = 1, pageSize = 5): Promise<MyAppointmentsPage> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  const res = await fetch(`${API}/api/v1/appointments/mine?${params}`, { headers: authHeaders() })
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
export type Me = { id: number; full_name: string; email: string; role: string }
export async function getMe(): Promise<Me> {
  const res = await fetch(`${API}/api/v1/auth/me`, { headers: authHeaders() })
  if (!res.ok) await handleError(res, 'Không tải được thông tin tài khoản')
  return res.json()
}

export type AdminAppointment = Appointment & {
  patient_id: number; patient_name: string; patient_email: string
}
export type AdminStats = {
  total_users: number; total_doctors: number; total_appointments: number;
  pending_appointments: number; confirmed_appointments: number; cancelled_appointments: number
}
export type AdminUser = { id: number; full_name: string; email: string; phone?: string | null; role: string }
export async function listAdminStats(): Promise<AdminStats> {
  const res = await fetch(`${API}/api/v1/admin/stats`, { headers: authHeaders() })
  if (!res.ok) await handleError(res, 'Không tải được thống kê quản trị')
  return res.json()
}
export type Paginated<T> = { items: T[]; total: number; page: number; page_size: number; total_pages: number }
export async function listAdminAppointments(status?: string, page = 1, pageSize = 6): Promise<Paginated<AdminAppointment>> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (status) params.set('status', status)
  const res = await fetch(`${API}/api/v1/admin/appointments?${params}`, { headers: authHeaders() })
  if (!res.ok) await handleError(res, 'Không tải được danh sách lịch hẹn')
  return res.json()
}
export async function updateAdminAppointmentStatus(id: number, status: string): Promise<AdminAppointment> {
  const res = await fetch(`${API}/api/v1/admin/appointments/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) await handleError(res, 'Đổi trạng thái lịch hẹn không thành công')
  return res.json()
}
export async function listAdminUsers(page = 1, pageSize = 6): Promise<Paginated<AdminUser>> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  const res = await fetch(`${API}/api/v1/admin/users?${params}`, { headers: authHeaders() })
  if (!res.ok) await handleError(res, 'Không tải được danh sách người dùng')
  return res.json()
}
export async function updateUserRole(id: number, role: string): Promise<AdminUser> {
  const res = await fetch(`${API}/api/v1/admin/users/${id}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) await handleError(res, 'Đổi role không thành công')
  return res.json()
}

export async function cancelAppointment(id: number): Promise<Appointment> {
  const res = await fetch(`${API}/api/v1/appointments/${id}/cancel`, {
    method: 'POST', headers: authHeaders(),
  })
  if (!res.ok) await handleError(res, 'Hủy lịch không thành công')
  return res.json()
}
