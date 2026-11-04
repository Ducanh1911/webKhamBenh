export default function Pagination({ page, totalPages, total, onChange }: { page: number; totalPages: number; total: number; onChange: (p: number) => void }) {
  if (total === 0) return null
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)
  const pages: number[] = []
  for (let p = start; p <= end; p++) pages.push(p)
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink-500">Tổng {total} · Trang {page} / {totalPages}</p>
      <div className="flex items-center gap-1.5">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed">← Trước</button>
        {pages.map(p => (
          <button key={p} onClick={() => onChange(p)} className={`w-9 h-9 rounded-lg text-sm font-medium border ${p === page ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-ink-700 border-slate-200'}`}>{p}</button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white disabled:opacity-50 disabled:cursor-not-allowed">Sau →</button>
      </div>
    </div>
  )
}
