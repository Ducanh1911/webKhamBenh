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

// Quên mật khẩu (không cần đăng nhập): nhập email đã đăng ký + mật khẩu
// cũ + mật khẩu mới; chỉ khi mật khẩu cũ đúng mới cho đổi. Tài khoản
// quản trị không đặt lại được qua form này.
export async function forgotPassword(email: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${API}/api/v1/auth/forgot-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, current_password: currentPassword, new_password: newPassword }),
  })
  if (!res.ok) await handleError(res, 'Đặt lại mật khẩu không thành công')
  return res.json()
}

export type Specialty = { id: number; name: string; description?: string | null }
export type Doctor = {
  id: number; name: string; specialty_id: number; specialty_name: string;
  clinic_name: string; years_experience: number; consultation_fee: number; bio?: string | null
}
export type Appointment = {
  id: number; doctor_id: number; doctor_name: string; specialty_name: string;
  clinic_name: string; start_at: string; reason?: string | null; status: string;
  consultation_fee: number; payment_status: string; payment_id?: number | null
}
export type Payment = {
  id: number; appointment_id: number; order_id: string; amount: number;
  status: string; pay_url?: string | null; trans_id?: number | null; result_code?: number | null
}
export async function createPayment(appointmentId: number): Promise<Payment> {
  const res = await fetch(`${API}/api/v1/appointments/${appointmentId}/payments`, {
    method: 'POST', headers: authHeaders(),
  })
  if (!res.ok) await handleError(res, 'Không tạo được đơn thanh toán MoMo')
  return res.json()
}
export async function checkPayment(paymentId: number): Promise<Payment> {
  const res = await fetch(`${API}/api/v1/payments/${paymentId}/check`, {
    method: 'POST', headers: authHeaders(),
  })
  if (!res.ok) await handleError(res, 'Không kiểm tra được thanh toán')
  return res.json()
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
export type ChatMessage = { role: 'user' | 'assistant'; content: string }
export type ChatReply = {
  reply: string
  specialty: { id: number; name: string } | null
  doctors: { id: number; name: string; consultation_fee: number }[]
  priority: string
  disclaimer: string
}
// Chatbot tư vấn sức khỏe (Hướng B, LLM Gemini). Chưa cấu hình key thì
// server trả 503, handleError sẽ throw Error với detail tiếng Việt để UI hiện.
export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatReply> {
  const res = await fetch(`${API}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) await handleError(res, 'Trợ lý AI tạm thời không trả lời được, vui lòng thử lại sau')
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
export async function getBookedSlots(doctorId: number, date: string): Promise<string[]> {
  const res = await fetch(`${API}/api/v1/doctors/${doctorId}/booked-slots?date=${date}`)
  if (!res.ok) await handleError(res, 'Không tải được khung giờ đã đặt')
  const data = await res.json() as { booked_slots: string[] }
  return data.booked_slots.map(s => {
    const d = new Date(s)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })
}
export type Me = { id: number; full_name: string; email: string; role: string }
export async function getMe(): Promise<Me> {
  const res = await fetch(`${API}/api/v1/auth/me`, { headers: authHeaders() })
  if (!res.ok) await handleError(res, 'Không tải được thông tin tài khoản')
  return res.json()
}
export async function changePassword(current_password: string, new_password: string): Promise<{ message: string }> {
  const res = await fetch(`${API}/api/v1/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ current_password, new_password }),
  })
  if (!res.ok) await handleError(res, 'Đổi mật khẩu không thành công, vui lòng thử lại')
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
export async function listAdminUsers(page = 1, pageSize = 6, role?: string): Promise<Paginated<AdminUser>> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (role) params.set('role', role)
  const res = await fetch(`${API}/api/v1/admin/users?${params}`, { headers: authHeaders() })
  if (!res.ok) await handleError(res, 'Không tải được danh sách người dùng')
  return res.json()
}
export type AdminDoctorInfo = {
  specialty_id: number
  years_experience: number
  consultation_fee: number
  bio?: string | null
}
export async function createAdminUser(full_name: string, email: string, password: string, phone: string | null, role: string, doctor?: AdminDoctorInfo): Promise<AdminUser> {
  const res = await fetch(`${API}/api/v1/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ full_name, email, password, phone, role, ...(doctor ?? {}) }),
  })
  if (!res.ok) await handleError(res, 'Thêm người dùng không thành công')
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

export type DoctorMe = {
  doctor_id: number; user_id: number; full_name: string; email: string; phone?: string | null
  specialty_id: number; specialty_name: string; clinic_name: string
  years_experience: number; consultation_fee: number; bio?: string | null
  total_appointments: number; pending_appointments: number
  confirmed_appointments: number; today_appointments: number
}
export type DoctorAppointment = {
  id: number; patient_id: number; patient_name: string; patient_email: string
  patient_phone?: string | null; start_at: string; reason?: string | null; status: string
}
export async function getDoctorMe(): Promise<DoctorMe> {
  const res = await fetch(`${API}/api/v1/doctor/me`, { headers: authHeaders() })
  if (!res.ok) await handleError(res, 'Không tải được hồ sơ bác sĩ')
  return res.json()
}
export async function listDoctorAppointments(status?: string, page = 1, pageSize = 6): Promise<Paginated<DoctorAppointment>> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (status) params.set('status', status)
  const res = await fetch(`${API}/api/v1/doctor/appointments?${params}`, { headers: authHeaders() })
  if (!res.ok) await handleError(res, 'Không tải được danh sách lịch hẹn')
  return res.json()
}
export async function updateDoctorAppointmentStatus(id: number, status: string): Promise<DoctorAppointment> {
  const res = await fetch(`${API}/api/v1/doctor/appointments/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) await handleError(res, 'Đổi trạng thái lịch hẹn không thành công')
  return res.json()
}
