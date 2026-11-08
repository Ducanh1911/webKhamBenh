import { useEffect } from 'react'

// Popup thông báo thành công giữa màn hình: tự tắt sau 5 giây,
// bấm nền hoặc nút Đóng để tắt ngay. Dùng chung cho mọi tác vụ
// (đăng nhập, đặt lịch, hủy lịch, thêm người dùng...).
export default function SuccessPopup({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [message, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        role="status"
        className="w-full max-w-sm bg-white rounded-xl shadow-card p-6 text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
          <span className="text-teal-700 text-2xl font-bold leading-none">✓</span>
        </div>
        <p className="font-semibold text-ink-900 mt-4">Thành công</p>
        <p className="text-sm text-ink-700 mt-1.5">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-10 px-5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium"
        >
          Đóng
        </button>
      </div>
    </div>
  )
}
