import { useEffect, useState } from 'react'
import { listDoctors, listSpecialties, listMyAppointments, createAppointment, cancelAppointment, type Doctor, type Specialty, type Appointment } from '../lib/api'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ xác nhận', pending: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận', confirmed: 'Đã xác nhận',
  COMPLETED: 'Đã khám xong', completed: 'Đã khám xong',
  CANCELLED: 'Đã hủy', cancelled: 'Đã hủy',
  NO_SHOW: 'Không đến khám', no_show: 'Không đến khám',
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [specialtyId, setSpecialtyId] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [reason, setReason] = useState('')
  const [booking, setBooking] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [specs, docs, appts] = await Promise.all([
        listSpecialties(), listDoctors(specialtyId), listMyAppointments(),
      ])
      setSpecialties(specs)
      setDoctors(docs)
      setAppointments(appts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [specialtyId])

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault()
    if (!bookingDoctor || !date) return
    setBooking(true)
    setError('')
    setNotice('')
    try {
      const startAt = new Date(`${date}T${time}:00`).toISOString()
      await createAppointment(bookingDoctor.id, startAt, reason || undefined)
      setNotice(`Đã đặt lịch với ${bookingDoctor.name} lúc ${time} ngày ${new Date(date).toLocaleDateString('vi-VN')}.`)
      setBookingDoctor(null)
      setReason('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt lịch không thành công.')
    } finally {
      setBooking(false)
    }
  }

  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState(false)

  async function onCancel(id: number) {
    setCancelling(true)
    try {
      await cancelAppointment(id)
      setNotice('Đã hủy lịch hẹn.')
      setConfirmCancelId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hủy lịch không thành công.')
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
            <span className="font-semibold text-lg tracking-tight">MediBook <span className="text-brand-700">AI</span></span>
          </div>
          <button onClick={onLogout} className="text-sm font-medium text-ink-500 hover:text-ink-900 border border-slate-200 rounded-lg px-3.5 py-2 bg-white">Đăng xuất</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Đặt lịch khám</h1>
        <p className="text-ink-500 mt-1.5 text-[15px]">Tìm bác sĩ theo chuyên khoa, chọn khung giờ và đặt lịch trong vài phút.</p>

        {notice && <p className="mt-5 rounded-lg bg-teal-50 border border-teal-100 text-teal-800 text-sm px-3.5 py-2.5">{notice}</p>}
        {error && <p className="mt-5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm px-3.5 py-2.5">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => setSpecialtyId(undefined)} className={`px-3.5 py-2 rounded-full text-sm font-medium border ${specialtyId === undefined ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>Tất cả chuyên khoa</button>
          {specialties.map(s => (
            <button key={s.id} onClick={() => setSpecialtyId(s.id)} className={`px-3.5 py-2 rounded-full text-sm font-medium border ${specialtyId === s.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>{s.name}</button>
          ))}
        </div>

        {loading ? (
          <p className="mt-8 text-ink-500 text-sm">Đang tải danh sách bác sĩ…</p>
        ) : doctors.length === 0 ? (
          <div className="mt-8 bg-white border border-slate-200 rounded-xl p-6 shadow-card">
            <p className="font-medium">Chưa có bác sĩ cho chuyên khoa này</p>
            <p className="text-sm text-ink-500 mt-1">Hiện hệ thống chưa có bác sĩ nào. Vui lòng chọn chuyên khoa khác hoặc quay lại sau.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {doctors.map(d => (
              <div key={d.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-card flex flex-col">
                <p className="font-semibold">{d.name}</p>
                <p className="text-sm text-brand-700 font-medium mt-0.5">{d.specialty_name}</p>
                <p className="text-sm text-ink-500 mt-2">{d.clinic_name} · {d.years_experience} năm kinh nghiệm</p>
                <p className="text-sm text-ink-900 font-medium mt-2">{d.consultation_fee.toLocaleString('vi-VN')} đ / lượt khám</p>
                {d.bio && <p className="text-sm text-ink-500 mt-1 line-clamp-2">{d.bio}</p>}
                <button onClick={() => { setBookingDoctor(d); setNotice(''); setError('') }} className="mt-4 h-10 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium">Đặt lịch với bác sĩ này</button>
              </div>
            ))}
          </div>
        )}

        {bookingDoctor && (
          <form onSubmit={submitBooking} className="mt-8 bg-white border border-slate-200 rounded-xl p-6 shadow-card max-w-xl">
            <h2 className="font-semibold text-lg">Đặt lịch với {bookingDoctor.name}</h2>
            <p className="text-sm text-ink-500 mt-1">{bookingDoctor.specialty_name} · {bookingDoctor.clinic_name} · {bookingDoctor.consultation_fee.toLocaleString('vi-VN')} đ</p>
            <div className="grid grid-cols-2 gap-4 mt-5">
              <label className="block">
                <span className="text-sm font-medium">Ngày khám</span>
                <input type="date" required value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Giờ khám</span>
                <select value={time} onChange={e => setTime(e.target.value)} className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5 bg-white">
                  {['08:00','09:00','10:00','11:00','13:30','14:30','15:30','16:30'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
            <label className="block mt-4">
              <span className="text-sm font-medium">Lý do khám <span className="text-ink-500 font-normal">(không bắt buộc)</span></span>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Ví dụ: đau họng 2 ngày" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
            </label>
            <div className="flex gap-3 mt-5">
              <button type="submit" disabled={booking} className="h-11 px-5 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-medium">{booking ? 'Đang đặt lịch…' : 'Xác nhận đặt lịch'}</button>
              <button type="button" onClick={() => setBookingDoctor(null)} className="h-11 px-5 rounded-lg border border-slate-200 bg-white text-sm font-medium">Đóng</button>
            </div>
          </form>
        )}

        <h2 className="text-lg font-semibold mt-10">Lịch hẹn của tôi</h2>
        {appointments.length === 0 ? (
          <p className="text-sm text-ink-500 mt-2">Bạn chưa có lịch hẹn nào. Hãy chọn một bác sĩ ở trên để đặt lịch.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {appointments.map(a => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{a.doctor_name} · {a.specialty_name}</p>
                  <p className="text-sm text-ink-500 mt-1">{fmtDateTime(a.start_at)} · {a.clinic_name}{a.reason ? ` · ${a.reason}` : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-brand-700">{STATUS_LABEL[a.status] ?? a.status}</span>
                  {(a.status === 'PENDING' || a.status === 'pending' || a.status === 'CONFIRMED' || a.status === 'confirmed') && (
                    confirmCancelId === a.id ? (
                      <span className="flex items-center gap-2">
                        <span className="text-sm text-ink-700">Chắc chắn hủy?</span>
                        <button onClick={() => onCancel(a.id)} disabled={cancelling} className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg px-3 py-2">Hủy lịch này</button>
                        <button onClick={() => setConfirmCancelId(null)} className="text-sm font-medium text-ink-700 border border-slate-200 rounded-lg px-3 py-2 bg-white">Giữ lại</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmCancelId(a.id)} className="text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-3 py-2 bg-white">Hủy lịch</button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
