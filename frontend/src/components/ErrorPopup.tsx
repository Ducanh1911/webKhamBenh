import { useEffect } from 'react'

// Popup lỗi giữa màn hình: tự tắt sau 5 giây, bấm nền hoặc nút × để tắt ngay.
export default function ErrorPopup({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [message, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        role="alert"
        className="w-full max-w-sm bg-white rounded-xl shadow-card p-6 text-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-red-600 text-2xl font-bold leading-none">×</span>
        </div>
        <p className="font-semibold text-ink-900 mt-4">Đã xảy ra lỗi</p>
        <p className="text-sm text-ink-700 mt-1.5">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-10 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
        >
          Đóng
        </button>
      </div>
    </div>
  )
}
