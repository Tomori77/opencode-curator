import { btnSmall, colors } from '../ui'

interface PaginationProps {
  page: number
  pageCount: number
  onPage: (page: number) => void
}

export function Pagination({ page, pageCount, onPage }: PaginationProps) {
  const total = Math.max(pageCount, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
      <button style={btnSmall} onClick={() => onPage(page - 1)} disabled={page <= 1}>
        上一页
      </button>
      <span style={{ fontSize: 13, color: colors.secondary }}>
        第 {page} / {total} 页
      </span>
      <button style={btnSmall} onClick={() => onPage(page + 1)} disabled={page >= total}>
        下一页
      </button>
    </div>
  )
}
