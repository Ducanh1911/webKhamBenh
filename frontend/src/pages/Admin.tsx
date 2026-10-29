import { useEffect, useState } from 'react'
import {
  listAdminAppointments, listAdminStats, listAdminUsers, updateAdminAppointmentStatus, updateUserRole,
  type AdminAppointment, type AdminStats, type AdminUser,
} from '../lib/api'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Đã khám xong',
  cancelled: 'Đã hủy', no_show: 'Không đến khám',
}
const ROLE_LABEL: Record<string, string> = { patient: 'Bệnh nhân', doctor: 'Bác sĩ', admin: 'Quản trị' }

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPage({ onLogout, onGoBooking }: { onLogout: () => void; onGoBooking: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [appointments, setAppointments] = useState<AdminAppointment[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [s, a, u] = await Promise.all([
        listAdminStats(), listAdminAppointments(statusFilter || undefined), listAdminUsers(),
      ])
      setStats(s)
      setAppointments(a)
      setUsers(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu quản trị.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [statusFilter])

  async function changeStatus(id: number, status: string) {
    setError('')
    setNotice('')
    try {
      await updateAdminAppointmentStatus(id, status)
      setNotice('Đã đổi trạng thái lịch hẹn.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đổi trạng thái không thành công.')
    }
  }

  async function changeRole(id: number, role: string) {
    setError('')
    setNotice('')
    try {
      await updateUserRole(id, role)
      setNotice('Đã đổi role người dùng.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đổi role không thành công.')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-700 text-white flex items-center justify-center font-bold">M</div>
            <span className="font-semibold text-lg tracking-tight">MediBook <span className="text-brand-700">AI</span> · Quản trị</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onGoBooking} className="text-sm font-medium text-ink-500 hover:text-ink-900 border border-slate-200 rounded-lg px-3.5 py-2 bg-white">Về đặt lịch</button>
            <button onClick={onLogout} className="text-sm font-medium text-ink-500 hover:text-ink-900 border border-slate-200 rounded-lg px-3.5 py-2 bg-white">Đăng xuất</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Quản trị hệ thống</h1>
        <p className="text-ink-500 mt-1.5 text-[15px]">Xem toàn bộ lịch hẹn, xác nhận / hủy lịch và phân quyền người dùng. Chỉ tài khoản admin mới vào được trang này.</p>
        {notice && <p className="mt-5 rounded-lg bg-teal-50 border border-teal-100 text-teal-800 text-sm px-3.5 py-2.5">{notice}</p>}
        {error && <p className="mt-5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm px-3.5 py-2.5">{error}</p>}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card"><p className="text-2xl font-semibold">{stats.total_users}</p><p className="text-sm text-ink-500">Người dùng</p></div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card"><p className="text-2xl font-semibold">{stats.total_doctors}</p><p className="text-sm text-ink-500">Bác sĩ</p></div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card"><p className="text-2xl font-semibold">{stats.total_appointments}</p><p className="text-sm text-ink-500">Tổng lịch hẹn</p></div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card"><p className="text-2xl font-semibold">{stats.pending_appointments}</p><p className="text-sm text-ink-500">Chờ xác nhận</p></div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card"><p className="text-2xl font-semibold">{stats.confirmed_appointments}</p><p className="text-sm text-ink-500">Đã xác nhận</p></div>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card"><p className="text-2xl font-semibold">{stats.cancelled_appointments}</p><p className="text-sm text-ink-500">Đã hủy</p></div>
          </div>
        )}

        <h2 className="text-lg font-semibold mt-10">Tất cả lịch hẹn</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {['', 'pending', 'confirmed', 'completed', 'cancelled'].map(s => (
            <button key={s || 'all'} onClick={() => setStatusFilter(s)} className={`px-3.5 py-2 rounded-full text-sm font-medium border ${statusFilter === s ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>
              {s === '' ? 'Tất cả' : STATUS_LABEL[s] ?? s}
            </button>
          ))}
        </div>
        {loading ? <p className="mt-4 text-ink-500 text-sm">Đang tải…</p> : appointments.length === 0 ? (
          <p className="text-sm text-ink-500 mt-3">Chưa có lịch hẹn nào.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {appointments.map(a => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{a.patient_name} · {a.doctor_name} ({a.specialty_name})</p>
                  <p className="text-sm text-ink-500 mt-1">{fmtDateTime(a.start_at)} · {a.clinic_name}{a.reason ? ` · ${a.reason}` : ''} · {a.patient_email}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-brand-700">{STATUS_LABEL[a.status] ?? a.status}</span>
                  {a.status === 'pending' && <button onClick={() => changeStatus(a.id, 'confirmed')} className="text-sm font-medium text-white bg-brand-700 hover:bg-brand-800 rounded-lg px-3 py-2">Xác nhận</button>}
                  {(a.status === 'pending' || a.status === 'confirmed') && <button onClick={() => changeStatus(a.id, 'cancelled')} className="text-sm font-medium text-red-600 border border-red-200 rounded-lg px-3 py-2 bg-white">Hủy lịch</button>}
                  {a.status === 'confirmed' && <button onClick={() => changeStatus(a.id, 'completed')} className="text-sm font-medium text-teal-700 border border-teal-200 rounded-lg px-3 py-2 bg-white">Đã khám xong</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-lg font-semibold mt-10">Người dùng</h2>
        <div className="mt-4 space-y-3">
          {users.map(u => (
            <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-card flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">{u.full_name}</p>
                <p className="text-sm text-ink-500 mt-1">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
              </div>
              <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} className="h-10 rounded-lg border border-slate-300 px-3 bg-white text-sm font-medium">
                <option value="patient">{ROLE_LABEL.patient}</option>
                <option value="doctor">{ROLE_LABEL.doctor}</option>
                <option value="admin">{ROLE_LABEL.admin}</option>
              </select>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
