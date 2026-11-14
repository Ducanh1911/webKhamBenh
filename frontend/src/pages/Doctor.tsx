import { useCallback, useEffect, useState } from 'react'
import {
  getDoctorMe, listDoctorAppointments, updateDoctorAppointmentStatus,
  type DoctorAppointment, type DoctorMe,
} from '../lib/api'
import Pagination from '../components/Pagination'
import ErrorPopup from '../components/ErrorPopup'
import SuccessPopup from '../components/SuccessPopup'
import ChangePasswordModal from '../components/ChangePasswordModal'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Đã khám xong',
  cancelled: 'Đã hủy', no_show: 'Không đến khám',
}

const PAGE_SIZE = 6
type Tab = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ xác nhận' },
  { id: 'confirmed', label: 'Đã xác nhận' },
  { id: 'completed', label: 'Đã hoàn thành' },
  { id: 'cancelled', label: 'Đã hủy' },
]

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function DoctorPage({ onLogout, onClearAuthNotice }: { onLogout: () => void; onClearAuthNotice?: () => void }) {
  const [me, setMe] = useState<DoctorMe | null>(null)
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([])
  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const dismissError = useCallback(() => setError(''), [])
  const [notice, setNotice] = useState('')
  const dismissNotice = useCallback(() => setNotice(''), [])
  // Thông báo thành công của riêng trang này thay thế popup "đăng nhập
  // thành công" hiện ở App, tránh 2 popup chồng lên nhau.
  useEffect(() => { if (notice) onClearAuthNotice?.() }, [notice, onClearAuthNotice])
  const [cancelTarget, setCancelTarget] = useState<DoctorAppointment | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [m, a] = await Promise.all([
        getDoctorMe(),
        listDoctorAppointments(tab === 'all' ? undefined : tab, page, PAGE_SIZE),
      ])
      setMe(m)
      setAppointments(a.items)
      setTotal(a.total)
      setTotalPages(a.total_pages)
      if (a.total_pages > 0 && page > a.total_pages) setPage(a.total_pages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu bác sĩ.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [tab, page])

  function switchTab(t: Tab) {
    setTab(t)
    setPage(1)
  }

  async function changeStatus(id: number, status: string) {
    setError('')
    setNotice('')
    try {
      await updateDoctorAppointmentStatus(id, status)
      setNotice('Đã đổi trạng thái lịch hẹn.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đổi trạng thái không thành công.')
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      await changeStatus(cancelTarget.id, 'cancelled')
      setCancelTarget(null)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-700 text-white flex items-center justify-center font-bold">M</div>
            <span className="font-semibold text-lg tracking-tight">MediBook <span className="text-brand-700">AI</span> · Bác sĩ</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowChangePassword(true)} className="text-sm font-medium text-ink-500 hover:text-ink-900 border border-slate-200 rounded-lg px-3.5 py-2 bg-white">Đổi mật khẩu</button>
            <button onClick={onLogout} className="text-sm font-medium text-ink-500 hover:text-ink-900 border border-slate-200 rounded-lg px-3.5 py-2 bg-white">Đăng xuất</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{me ? me.full_name : 'Trang bác sĩ'}</h1>
        <p className="text-ink-500 mt-1.5 text-[15px]">Xem lịch hẹn của bạn, xác nhận / hủy / hoàn thành lịch khám. Chỉ tài khoản bác sĩ mới vào được trang này.</p>
        {notice && <SuccessPopup message={notice} onClose={dismissNotice} />}
        {error && <ErrorPopup message={error} onClose={dismissError} />}

        {me && (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card mt-6">
              <p className="font-semibold">{me.full_name}</p>
              <p className="text-sm text-brand-700 font-medium mt-0.5">{me.specialty_name}</p>
              <p className="text-sm text-ink-500 mt-2">{me.clinic_name} · {me.years_experience} năm kinh nghiệm · {me.consultation_fee.toLocaleString('vi-VN')} đ / lượt khám</p>
              <p className="text-sm text-ink-500 mt-1">{me.email}{me.phone ? ` · ${me.phone}` : ''}</p>
              {me.bio && <p className="text-sm text-ink-500 mt-1">{me.bio}</p>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card"><p className="text-2xl font-semibold">{me.total_appointments}</p><p className="text-sm text-ink-500">Tổng lịch hẹn</p></div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card"><p className="text-2xl font-semibold">{me.pending_appointments}</p><p className="text-sm text-ink-500">Chờ xác nhận</p></div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card"><p className="text-2xl font-semibold">{me.confirmed_appointments}</p><p className="text-sm text-ink-500">Đã xác nhận</p></div>
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card"><p className="text-2xl font-semibold">{me.today_appointments}</p><p className="text-sm text-ink-500">Lịch hôm nay</p></div>
            </div>
          </>
        )}

        <div className="mt-10 flex flex-wrap gap-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)} className={`px-3.5 py-2 rounded-full text-sm font-medium border ${tab === t.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <h2 className="text-lg font-semibold mt-6">{tab === 'all' ? 'Tất cả lịch hẹn' : `Lịch hẹn · ${STATUS_LABEL[tab] ?? tab}`}</h2>
        {loading ? <p className="mt-4 text-ink-500 text-sm">Đang tải…</p> : appointments.length === 0 ? (
          <p className="text-sm text-ink-500 mt-3">Chưa có lịch hẹn nào trong tab này.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {appointments.map(a => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{a.patient_name}{a.patient_phone ? ` · ${a.patient_phone}` : ''}</p>
                  <p className="text-sm text-ink-500 mt-1">{fmtDateTime(a.start_at)}{a.reason ? ` · ${a.reason}` : ''} · {a.patient_email}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-brand-700">{STATUS_LABEL[a.status] ?? a.status}</span>
                  {a.status === 'pending' && <button onClick={() => changeStatus(a.id, 'confirmed')} className="text-sm font-medium text-white bg-brand-700 hover:bg-brand-800 rounded-lg px-3 py-2">Xác nhận</button>}
                  {a.status === 'confirmed' && <button onClick={() => changeStatus(a.id, 'completed')} className="text-sm font-medium text-teal-700 border border-teal-200 rounded-lg px-3 py-2 bg-white">Hoàn thành</button>}
                  {(a.status === 'pending' || a.status === 'confirmed') && <button onClick={() => setCancelTarget(a)} className="text-sm font-medium text-red-600 border border-red-200 rounded-lg px-3 py-2 bg-white">Hủy lịch</button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && total > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        )}
      </main>
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setCancelTarget(null)}>
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 shadow-card text-center" onClick={e => e.stopPropagation()}>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-2xl font-bold leading-none">×</span>
            </div>
            <h2 className="font-semibold text-lg mt-4">Hủy lịch hẹn?</h2>
            <p className="text-sm text-ink-500 mt-1.5">{cancelTarget.patient_name} · {fmtDateTime(cancelTarget.start_at)}</p>
            <p className="text-sm text-ink-700 mt-2">Bạn có muốn hủy lịch này không?</p>
            <div className="flex gap-3 mt-5 justify-center">
              <button onClick={confirmCancel} disabled={cancelling} className="h-11 px-5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium">{cancelling ? 'Đang hủy…' : 'Hủy lịch này'}</button>
              <button onClick={() => setCancelTarget(null)} className="h-11 px-5 rounded-lg border border-slate-200 bg-white text-sm font-medium">Giữ lại</button>
            </div>
          </div>
        </div>
      )}
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} onSuccess={setNotice} />
      )}
    </div>
  )
}
