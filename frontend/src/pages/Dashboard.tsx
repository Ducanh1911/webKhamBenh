import { useEffect, useState } from 'react'
import { listDoctors, listSpecialties, listMyAppointments, createAppointment, cancelAppointment, requestTriage, type Doctor, type Specialty, type Appointment, type TriageResult } from '../lib/api'
import Pagination from '../components/Pagination'

const PRIORITY_LABEL: Record<string, string> = {
  routine: 'Khám thường',
  urgent: 'Khám gấp trong ngày',
  emergency: 'Đi cấp cứu ngay — gọi 115',
}

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
  const [view, setView] = useState<'booking' | 'mine'>('booking')
  const [doctorPage, setDoctorPage] = useState(1)
  const [doctorTotalPages, setDoctorTotalPages] = useState(0)
  const [doctorTotal, setDoctorTotal] = useState(0)
  const [apptPage, setApptPage] = useState(1)
  const [apptTotalPages, setApptTotalPages] = useState(0)
  const [apptTotal, setApptTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [bookingDoctor, setBookingDoctor] = useState<Doctor | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [reason, setReason] = useState('')
  const [booking, setBooking] = useState(false)
  const [symptoms, setSymptoms] = useState('')
  const [triage, setTriage] = useState<TriageResult | null>(null)
  const [triaging, setTriaging] = useState(false)

  async function onTriage(e: React.FormEvent) {
    e.preventDefault()
    if (symptoms.trim().length < 2) return
    setTriaging(true)
    setError('')
    try {
      setTriage(await requestTriage(symptoms.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gợi ý được bác sĩ, vui lòng thử lại.')
    } finally {
      setTriaging(false)
    }
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [specs, docs, appts] = await Promise.all([
        listSpecialties(), listDoctors(specialtyId, doctorPage), listMyAppointments(apptPage),
      ])
      setSpecialties(specs)
      setDoctors(docs.doctors)
      setDoctorTotal(docs.total)
      setDoctorTotalPages(docs.total_pages)
      if (docs.total_pages > 0 && doctorPage > docs.total_pages) setDoctorPage(docs.total_pages)
      setAppointments(appts.appointments)
      setApptTotal(appts.total)
      setApptTotalPages(appts.total_pages)
      if (appts.total_pages > 0 && apptPage > appts.total_pages) setApptPage(appts.total_pages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được dữ liệu, vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [specialtyId, doctorPage, apptPage])

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
      setView('mine')
      if (apptPage !== 1) setApptPage(1)
      else await load()
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
          <div className="flex gap-2">
            <button onClick={onLogout} className="text-sm font-medium text-ink-500 hover:text-ink-900 border border-slate-200 rounded-lg px-3.5 py-2 bg-white">Đăng xuất</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{view === 'mine' ? 'Lịch hẹn của tôi' : 'Đặt lịch khám'}</h1>
        <p className="text-ink-500 mt-1.5 text-[15px]">{view === 'mine' ? 'Toàn bộ lịch hẹn của bạn, tách biệt khỏi trang đặt lịch.' : 'Tìm bác sĩ theo chuyên khoa, chọn khung giờ và đặt lịch trong vài phút.'}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => setView('booking')} className={`px-3.5 py-2 rounded-full text-sm font-medium border ${view === 'booking' ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>Đặt lịch khám</button>
          <button onClick={() => setView('mine')} className={`px-3.5 py-2 rounded-full text-sm font-medium border ${view === 'mine' ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>Lịch hẹn của tôi{apptTotal > 0 ? ` (${apptTotal})` : ''}</button>
        </div>

        {notice && <p className="mt-5 rounded-lg bg-teal-50 border border-teal-100 text-teal-800 text-sm px-3.5 py-2.5">{notice}</p>}
        {error && <p className="mt-5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm px-3.5 py-2.5">{error}</p>}

        {view === 'booking' && (
        <>
        <form onSubmit={onTriage} className="mt-6 bg-white border border-slate-200 rounded-xl p-5 shadow-card">
          <label className="block">
            <span className="text-sm font-medium">Mô tả triệu chứng của bạn</span>
            <input type="text" value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="Ví dụ: đau răng, sưng lợi 2 ngày" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
          </label>
          <button type="submit" disabled={triaging || symptoms.trim().length < 2} className="mt-3 h-11 px-5 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-medium">{triaging ? 'Đang gợi ý…' : 'Gợi ý bác sĩ'}</button>
          {triage && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              {triage.priority === 'emergency' ? (
                <p className="font-semibold text-red-700">Dấu hiệu nguy hiểm — {PRIORITY_LABEL[triage.priority]}</p>
              ) : (
                <p className="font-semibold">Gợi ý: {triage.specialty ? `${triage.specialty.name}${triage.doctors.length > 0 ? ` · ${triage.doctors[0].name}` : ''}` : 'Chưa xác định được chuyên khoa'} <span className="text-sm font-medium text-brand-700">· {PRIORITY_LABEL[triage.priority] ?? triage.priority}</span></p>
              )}
              <p className="text-sm text-ink-500 mt-1">{triage.reason}</p>
              {triage.follow_up_questions.length > 0 && (
                <ul className="text-sm text-ink-700 mt-2 list-disc pl-5 space-y-0.5">
                  {triage.follow_up_questions.map(q => <li key={q}>{q}</li>)}
                </ul>
              )}
              {triage.specialty && triage.priority !== 'emergency' && (
                <button type="button" onClick={() => { setSpecialtyId(triage.specialty!.id); setDoctorPage(1) }} className="mt-3 h-10 px-4 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium">Xem bác sĩ {triage.specialty.name}</button>
              )}
              <p className="text-xs text-ink-500 mt-3">{triage.disclaimer}</p>
            </div>
          )}
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => { setSpecialtyId(undefined); setDoctorPage(1) }} className={`px-3.5 py-2 rounded-full text-sm font-medium border ${specialtyId === undefined ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>Tất cả chuyên khoa</button>
          {specialties.map(s => (
            <button key={s.id} onClick={() => { setSpecialtyId(s.id); setDoctorPage(1) }} className={`px-3.5 py-2 rounded-full text-sm font-medium border ${specialtyId === s.id ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>{s.name}</button>
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
        {!loading && doctors.length > 0 && (
          <Pagination page={doctorPage} totalPages={doctorTotalPages} total={doctorTotal} onChange={setDoctorPage} />
        )}
        </>
        )}


        {view === 'mine' && (
        <>
        {appointments.length === 0 ? (
          <p className="text-sm text-ink-500 mt-2">Bạn chưa có lịch hẹn nào. Hãy sang tab Đặt lịch khám để chọn bác sĩ.</p>
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
        {appointments.length > 0 && (
          <Pagination page={apptPage} totalPages={apptTotalPages} total={apptTotal} onChange={setApptPage} />
        )}
        </>
        )}
      </main>
        {bookingDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setBookingDoctor(null)}>
            <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-xl p-6 shadow-card" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-semibold text-lg">Đặt lịch với {bookingDoctor.name}</h2>
                <button type="button" aria-label="Đóng" onClick={() => setBookingDoctor(null)} className="text-ink-500 hover:text-ink-900 text-xl leading-none px-2 py-1">×</button>
              </div>
              <form onSubmit={submitBooking}>
              <p className="text-sm text-ink-500 mt-1 mb-1">{bookingDoctor.specialty_name} · {bookingDoctor.clinic_name} · {bookingDoctor.consultation_fee.toLocaleString('vi-VN')} đ</p>
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
            </div>
          </div>
        )}
    </div>
  )
}
