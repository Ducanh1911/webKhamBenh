import { useCallback, useState } from 'react'
import { changePassword } from '../lib/api'
import ErrorPopup from './ErrorPopup'

// Modal đổi mật khẩu dùng chung cho bệnh nhân và bác sĩ: 3 ô nhập,
// validate ở client trước rồi mới gọi API. Lỗi validate hiện ngay trong
// form, lỗi từ API hiện bằng ErrorPopup; thành công thì báo về trang cha
// để hiện SuccessPopup rồi đóng modal.
export default function ChangePasswordModal({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: (message: string) => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [error, setError] = useState('')
  const dismissError = useCallback(() => setError(''), [])
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPassword) { setFormError('Vui lòng nhập mật khẩu hiện tại.'); return }
    if (newPassword.length < 6) { setFormError('Mật khẩu mới phải có ít nhất 6 ký tự.'); return }
    if (newPassword === currentPassword) { setFormError('Mật khẩu mới phải khác mật khẩu hiện tại.'); return }
    if (newPassword !== confirmPassword) { setFormError('Mật khẩu nhập lại chưa khớp với mật khẩu mới.'); return }
    setSaving(true)
    setFormError('')
    setError('')
    try {
      const data = await changePassword(currentPassword, newPassword)
      onSuccess(data.message || 'Đổi mật khẩu thành công.')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi mật khẩu không thành công.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 shadow-card" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-semibold text-lg">Đổi mật khẩu</h2>
            <button type="button" aria-label="Đóng" onClick={onClose} className="text-ink-500 hover:text-ink-900 text-xl leading-none px-2 py-1">×</button>
          </div>
          <form onSubmit={submit}>
            {formError && <p className="mt-4 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm px-3.5 py-2.5">{formError}</p>}
            <label className="block mt-4">
              <span className="text-sm font-medium">Mật khẩu hiện tại</span>
              <input type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Nhập mật khẩu hiện tại" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
            </label>
            <label className="block mt-4">
              <span className="text-sm font-medium">Mật khẩu mới</span>
              <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Ít nhất 6 ký tự" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
            </label>
            <label className="block mt-4">
              <span className="text-sm font-medium">Nhập lại mật khẩu mới</span>
              <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu mới" className="mt-1.5 w-full h-11 rounded-lg border border-slate-300 px-3.5" />
            </label>
            <div className="flex gap-3 mt-5">
              <button type="submit" disabled={saving} className="h-11 px-5 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-medium">{saving ? 'Đang đổi…' : 'Đổi mật khẩu'}</button>
              <button type="button" onClick={onClose} className="h-11 px-5 rounded-lg border border-slate-200 bg-white text-sm font-medium">Đóng</button>
            </div>
          </form>
        </div>
      </div>
      {error && <ErrorPopup message={error} onClose={dismissError} />}
    </>
  )
}
