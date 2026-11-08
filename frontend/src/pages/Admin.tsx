import { useCallback, useEffect, useState } from 'react'
import {
  createAdminUser, listAdminAppointments, listAdminStats, listAdminUsers, listSpecialties, updateAdminAppointmentStatus, updateUserRole,
  type AdminAppointment, type AdminStats, type AdminUser, type Specialty,
} from '../lib/api'
import Pagination from '../components/Pagination'
import SuccessPopup from '../components/SuccessPopup'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Đã khám xong',
  cancelled: 'Đã hủy', no_show: 'Không đến khám',
}
const ROLE_LABEL: Record<string, string> = { patient: 'Bệnh nhân', doctor: 'Bác sĩ', admin: 'Quản trị' }

const PAGE_SIZE = 6
type Tab = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'users'
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ xác nhận' },
  { id: 'confirmed', label: 'Đã xác nhận' },
  { id: 'completed', label: 'Đã khám xong' },
  { id: 'cancelled', label: 'Đã hủy' },
  { id: 'users', label: 'Người dùng' },
]

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminPage({ onLogout, onClearAuthNotice }: { onLogout: () => void; onClearAuthNotice?: () => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [appointments, setAppointments] = useState<AdminAppointment[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dismissNotice = useCallback(() => setNotice(''), [])
  // Thông báo thành công của riêng trang này thay thế popup "đăng nhập
  // thành công" hiện ở App, tránh 2 popup chồng lên nhau.
  useEffect(() => { if (notice) onClearAuthNotice?.() }, [notice, onClearAuthNotice])
  const [roleFilter, setRoleFilter] = useState<'all' | 'patient' | 'doctor' | 'admin'>('all')
  const [showAddUser, setShowAddUser] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addRole, setAddRole] = useState('patient')
  const [addUserError, setAddUserError] = useState('')
  const [adding, setAdding] = useState(false)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [addSpecialtyId, setAddSpecialtyId] = useState<number | ''>('')
  const [addYears, setAddYears] = useState('')
  const [addFee, setAddFee] = useState('')
  const [addBio, setAddBio] = useState('')
  const [cancelTarget, setCancelTarget] = useState<AdminAppointment | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    listSpecialties().then(setSpecialties).catch(() => undefined)
  }, [])

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

  async function submitAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (addName.trim().length < 2) { setAddUserError('Vui lòng nhập họ và tên.'); return }
    if (addRole === 'doctor' && addSpecialtyId === '') { setAddUserError('Vui lòng chọn chuyên khoa cho bác sĩ.'); return }
    setAdding(true)
    setAddUserError('')
    try {
      // Mật khẩu mặc định cho tài khoản mới là 123456 (không hiện ô nhập).
      await createAdminUser(
        addName.trim(), addEmail.trim(), '123456', addPhone.trim() || null, addRole,
        addRole === 'doctor' ? {
          specialty_id: Number(addSpecialtyId),
          years_experience: Number(addYears) || 0,
          consultation_fee: Number(addFee) || 0,
          bio: addBio.trim() || null,
        } : undefined,
      )
      setNotice('Thêm người dùng thành công.')
      setShowAddUser(false)
      setAddName(''); setAddEmail(''); setAddPhone(''); setAddRole('patient')
      setAddSpecialtyId(''); setAddYears(''); setAddFee(''); setAddBio('')
      // Người mới nằm cuối danh sách (sắp xếp theo id tăng dần). Về lại
      // bộ lọc Tất cả và tải trực tiếp trang cuối để thấy người mới ngay,
      // tránh đọc state roleFilter/page cũ trong closure.
      setRoleFilter('all')
      const first = await listAdminUsers(1, 1)
      const lastPage = Math.max(1, Math.ceil(first.total / PAGE_SIZE))
      const u = await listAdminUsers(lastPage, PAGE_SIZE)
      setUsers(u.items)
      setAppointments([])
      setTotal(u.total)
      setTotalPages(u.total_pages)
      setPage(lastPage)
    } catch (err) {
      setAddUserError(err instanceof Error ? err.message : 'Thêm người dùng không thành công.')
    } finally {
      setAdding(false)
    }
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const s = await listAdminStats()
      setStats(s)
      if (tab === 'users') {
        // Tab Người dùng tách biệt hoàn toàn: chỉ tải và chỉ hiện người dùng,
        // không lẫn với bất kỳ tab lịch hẹn nào.
        const u = await listAdminUsers(page, PAGE_SIZE, roleFilter === 'all' ? undefined : roleFilter)
        setUsers(u.items)
        setAppointments([])
        setTotal(u.total)
        setTotalPages(u.total_pages)
        if (u.total_pages > 0 && page > u.total_pages) setPage(u.total_pages)
      } else {
        const a = await listAdminAppointments(tab === 'all' ? undefined : tab, page, PAGE_SIZE)
        setAppointments(a.items)
        setUsers([])
        setTotal(a.total)
        setTotalPages(a.total_pages)
        if (a.total_pages > 0 && page > a.total_pages) setPage(a.total_pages)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu quản trị.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [tab, page, roleFilter])

  function switchTab(t: Tab) {
    setTab(t)
    setPage(1)
  }

  function switchRoleFilter(f: typeof roleFilter) {
    setRoleFilter(f)
    setPage(1)
  }

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
            <button onClick={onLogout} className="text-sm font-medium text-ink-500 hover:text-ink-900 border border-slate-200 rounded-lg px-3.5 py-2 bg-white">Đăng xuất</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Quản trị hệ thống</h1>
        <p className="text-ink-500 mt-1.5 text-[15px]">Xem toàn bộ lịch hẹn, xác nhận / hủy lịch và phân quyền người dùng. Chỉ tài khoản admin mới vào được trang này.</p>
        {notice && <SuccessPopup message={notice} onClose={dismissNotice} />}
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

        <div className="mt-10 flex flex-wrap gap-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)} className={`px-3.5 py-2 rounded-full text-sm font-medium border ${tab === t.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users' ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-6">
              <h2 className="text-lg font-semibold">Người dùng</h2>
              <div className="flex flex-wrap items-center gap-2">
                {([
                  { id: 'all', label: 'Tất cả' },
                  { id: 'patient', label: 'Bệnh nhân' },
                  { id: 'doctor', label: 'Bác sĩ' },
                  { id: 'admin', label: 'Quản trị' },
                ] as const).map(f => (
                  <button key={f.id} onClick={() => switchRoleFilter(f.id)} className={`px-3.5 py-2 rounded-full text-sm font-medium border ${roleFilter === f.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>
                    {f.label}
                  </button>
                ))}
                <button onClick={() => { setAddUserError(''); setShowAddUser(true) }} className="h-10 px-4 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium">Thêm người dùng</button>
              </div>
            </div>
            {loading ? <p className="mt-4 text-ink-500 text-sm">Đang tải…</p> : users.length === 0 ? (
              <p className="text-sm text-ink-500 mt-3">Chưa có người dùng nào.</p>
            ) : (
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
            )}
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold mt-6">{tab === 'all' ? 'Tất cả lịch hẹn' : `Lịch hẹn · ${STATUS_LABEL[tab] ?? tab}`}</h2>
            {loading ? <p className="mt-4 text-ink-500 text-sm">Đang tải…</p> : appointments.length === 0 ? (
              <p className="text-sm text-ink-500 mt-3">Chưa có lịch hẹn nào trong tab này.</p>
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
                      {(a.status === 'pending' || a.status === 'confirmed') && <button onClick={() => setCancelTarget(a)} className="text-sm font-medium text-red-600 border border-red-200 rounded-lg px-3 py-2 bg-white">Hủy lịch</button>}
                      {a.status === 'confirmed' && <button onClick={() => changeStatus(a.id, 'completed')} className="text-sm font-medium text-teal-700 border border-teal-200 rounded-lg px-3 py-2 bg-white">Đã khám xong</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {!loading && total > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
        )}
      </main>
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowAddUser(false)}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-xl p-6 shadow-card" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-semibold text-lg">Thêm người dùng</h2>
              <button type="button" aria-label="Đóng" onClick={() => setShowAddUser(false)} className="text-ink-500 hover:text-ink-900 text-xl leading-none px-2 py-1">×</button>
            </div>
            <form onSubmit={submitAddUser}>
              {addUserError && <p className="mt-4 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm px-3.5 py-2.5">{addUserError}</p>}
              <label className="block mt-4">
                <span className="text-sm font-medium">Họ và tên</span>
                <input type="text" required value={addName} onChange={e => setAddName(e.target.value)} placeholder="Nguyễn Văn A" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
              </label>
              <label className="block mt-4">
                <span className="text-sm font-medium">Email</span>
                <input type="email" required value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="ban@example.com" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
              </label>
              <label className="block mt-4">
                <span className="text-sm font-medium">Số điện thoại <span className="text-ink-500 font-normal">(không bắt buộc)</span></span>
                <input type="tel" value={addPhone} onChange={e => setAddPhone(e.target.value)} placeholder="0900000000" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
              </label>
              <p className="mt-4 rounded-lg bg-slate-50 border border-slate-200 text-ink-500 text-sm px-3.5 py-2.5">Tài khoản mới sẽ dùng mật khẩu mặc định <span className="font-medium text-ink-900">123456</span>.</p>
              <label className="block mt-4">
                <span className="text-sm font-medium">Vai trò</span>
                <select value={addRole} onChange={e => setAddRole(e.target.value)} className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5 bg-white">
                  <option value="patient">{ROLE_LABEL.patient}</option>
                  <option value="doctor">{ROLE_LABEL.doctor}</option>
                  <option value="admin">{ROLE_LABEL.admin}</option>
                </select>
              </label>
              {addRole === 'doctor' && (
                <>
                  <label className="block mt-4">
                    <span className="text-sm font-medium">Chuyên khoa</span>
                    <select value={addSpecialtyId} onChange={e => setAddSpecialtyId(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5 bg-white">
                      <option value="">Chọn chuyên khoa</option>
                      {specialties.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block mt-4">
                      <span className="text-sm font-medium">Số năm kinh nghiệm</span>
                      <input type="number" min={0} value={addYears} onChange={e => setAddYears(e.target.value)} placeholder="10" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
                    </label>
                    <label className="block mt-4">
                      <span className="text-sm font-medium">Giá tiền (đ / lượt khám)</span>
                      <input type="number" min={0} step={1000} value={addFee} onChange={e => setAddFee(e.target.value)} placeholder="200000" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
                    </label>
                  </div>
                  <label className="block mt-4">
                    <span className="text-sm font-medium">Mô tả</span>
                    <textarea value={addBio} onChange={e => setAddBio(e.target.value)} placeholder="Ví dụ: Bác sĩ nhiều năm kinh nghiệm, tận tâm với bệnh nhân." rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5" />
                  </label>
                </>
              )}
              <div className="flex gap-3 mt-5">
                <button type="submit" disabled={adding} className="h-11 px-5 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-medium">{adding ? 'Đang thêm…' : 'Thêm người dùng'}</button>
                <button type="button" onClick={() => setShowAddUser(false)} className="h-11 px-5 rounded-lg border border-slate-200 bg-white text-sm font-medium">Đóng</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setCancelTarget(null)}>
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-6 shadow-card text-center" onClick={e => e.stopPropagation()}>
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-600 text-2xl font-bold leading-none">×</span>
            </div>
            <h2 className="font-semibold text-lg mt-4">Hủy lịch hẹn?</h2>
            <p className="text-sm text-ink-500 mt-1.5">{cancelTarget.patient_name} · {cancelTarget.doctor_name} · {fmtDateTime(cancelTarget.start_at)}</p>
            <p className="text-sm text-ink-700 mt-2">Bạn có muốn hủy lịch này không?</p>
            <div className="flex gap-3 mt-5 justify-center">
              <button onClick={confirmCancel} disabled={cancelling} className="h-11 px-5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium">{cancelling ? 'Đang hủy…' : 'Hủy lịch này'}</button>
              <button onClick={() => setCancelTarget(null)} className="h-11 px-5 rounded-lg border border-slate-200 bg-white text-sm font-medium">Giữ lại</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
