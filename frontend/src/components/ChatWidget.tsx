import { useEffect, useRef, useState } from 'react'
import { sendChatMessage, type ChatMessage } from '../lib/api'

// Chatbot tư vấn sức khỏe (Hướng B, LLM Gemini).
// Nút nổi góc dưới-phải, hiện trên mọi trang; bấm mở khung trò chuyện.
// Chưa cấu hình key Gemini (server trả 503) thì hiện tin nhắn hướng dẫn
// dùng ô "Mô tả triệu chứng" trên trang đặt lịch thay vì báo lỗi khô.

type Msg = {
  role: 'user' | 'assistant'
  content: string
  suggestion?: string | null
}

const WELCOME: Msg = {
  role: 'assistant',
  content:
    'Xin chào! Tôi là trợ lý AI MediBook. Bạn có thể mô tả triệu chứng, hỏi về bác sĩ hoặc cách đặt lịch khám.',
}

const QUICK_CHIPS = [
  'Tôi bị đau răng',
  'Tôi bị đau ngực',
  'Đặt lịch khám như thế nào?',
  'Bác sĩ tim mạch',
]

const NOT_CONFIGURED =
  "Trợ lý AI chưa được bật (chưa cấu hình khóa Gemini). Bạn vẫn có thể dùng ô 'Mô tả triệu chứng' trên trang đặt lịch để gợi ý bác sĩ."

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Cuộn xuống tin mới nhất mỗi khi có tin nhắn hoặc đang chờ trả lời.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading, open])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    const userMsg: Msg = { role: 'user', content: trimmed }
    const history: ChatMessage[] = [...messages, userMsg]
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const data = await sendChatMessage(history)
      let suggestion: string | null = null
      if (data.specialty && data.doctors.length > 0) {
        const list = data.doctors
          .map(d => `${d.name} (${d.consultation_fee.toLocaleString('vi-VN')}đ)`)
          .join(', ')
        suggestion = `Gợi ý: ${data.specialty.name} — ${list}. Bạn có thể đặt lịch ở tab Đặt lịch khám.`
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, suggestion }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Trợ lý AI tạm thời không trả lời được, vui lòng thử lại sau'
      const friendly = msg.includes('chưa được cấu hình') ? NOT_CONFIGURED : msg
      setMessages(prev => [...prev, { role: 'assistant', content: friendly }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-8rem)] flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-brand-700 text-white shrink-0">
            <div>
              <p className="font-semibold text-sm leading-tight">Trợ lý AI MediBook</p>
              <p className="text-xs text-teal-100 leading-tight">Tư vấn sơ bộ — trả lời bằng AI</p>
            </div>
            <button
              type="button"
              aria-label="Đóng trò chuyện"
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-brand-800 flex items-center justify-center text-xl leading-none"
            >
              ×
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#f7f8f7]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-brand-700 text-white text-sm whitespace-pre-wrap break-words'
                      : 'max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm bg-white border border-slate-200 text-ink-900 text-sm whitespace-pre-wrap break-words'
                  }
                >
                  {m.content}
                  {m.suggestion && (
                    <p className="mt-2 px-2 py-1.5 rounded-lg bg-brand-50 border border-brand-100 text-brand-800 text-xs">
                      {m.suggestion}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-white border border-slate-200 text-ink-500 text-sm">
                  đang trả lời…
                </div>
              </div>
            )}
          </div>

          <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 shrink-0">
            {QUICK_CHIPS.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => send(chip)}
                disabled={loading}
                className="px-2.5 py-1 rounded-full border border-brand-100 bg-brand-50 text-brand-800 text-xs hover:bg-brand-100 disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          <form
            className="p-3 pt-1.5 flex gap-2 shrink-0"
            onSubmit={e => {
              e.preventDefault()
              send(input)
            }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Nhập triệu chứng hoặc câu hỏi…"
              maxLength={1000}
              className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-sm outline-none focus:border-brand-700"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Gửi tin nhắn"
              className="w-10 h-10 shrink-0 rounded-lg bg-brand-700 hover:bg-brand-800 text-white flex items-center justify-center disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>

          <p className="px-3 pb-2.5 text-[11px] leading-snug text-ink-500 shrink-0">
            Tư vấn sơ bộ, không thay thế bác sĩ. Dấu hiệu nguy hiểm hãy gọi 115.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Mở trợ lý AI"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 h-12 pl-3.5 pr-4 rounded-full bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium shadow-xl"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        Trợ lý AI
      </button>
    </>
  )
}
