export default function Dashboard({ onLogout }: { onLogout: () => void }) {
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
        <p className="text-ink-500 mt-1.5 text-[15px]">Tìm bác sĩ theo chuyên khoa, chọn khung giờ trống và đặt lịch trong vài phút.</p>
        <div className="grid md:grid-cols-3 gap-4 mt-8">
          {['Nội tổng quát','Nhi khoa','Răng hàm mặt'].map(s => (
            <div key={s} className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
              <p className="font-medium">{s}</p>
              <p className="text-sm text-ink-500 mt-1">124 bác sĩ đang nhận lịch tuần này</p>
              <button className="mt-4 text-sm font-medium text-brand-700 hover:text-brand-800">Xem bác sĩ →</button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
