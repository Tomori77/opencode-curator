import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { getHealthReport } from '../api'
import type { HealthItem, HealthReport, OrphanChild } from '../api'
import {
  btnSmall,
  btnSmallDanger,
  cardStyle,
  colors,
  controlStyle,
  labelStyle,
  linkClass,
  metaStyle,
  sectionTitleStyle,
  subCardStyle,
  tableStyle,
  tdStyle,
  thStyle,
} from '../ui'

interface HealthPanelProps {
  onSelect?: (id: string) => void
  onBulkDelete?: (ids: string[]) => void
}

const cardLabel: CSSProperties = {
  fontSize: 12,
  color: colors.secondary,
  marginBottom: 4,
}

const cardValue: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: colors.text,
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

function ItemTable({
  items,
  onSelect,
}: {
  items: HealthItem[]
  onSelect?: (id: string) => void
}) {
  return (
    <table style={{ ...tableStyle, marginTop: 8 }}>
      <thead>
        <tr>
          <th style={thStyle}>标题</th>
          <th style={thStyle}>目录</th>
          <th style={thStyle}>更新时间</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr key={it.id}>
            <td style={tdStyle}>
              <span
                className={onSelect ? linkClass : undefined}
                onClick={onSelect ? () => onSelect(it.id) : undefined}
              >
                {it.title || it.id}
              </span>
            </td>
            <td style={{ ...tdStyle, color: colors.secondary }}>{it.directory}</td>
            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatTime(it.updated)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function HealthPanel({ onSelect, onBulkDelete }: HealthPanelProps) {
  const [staleInput, setStaleInput] = useState('90')
  const [staleDays, setStaleDays] = useState(90)
  const [report, setReport] = useState<HealthReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getHealthReport(staleDays)
      .then((data) => {
        if (!cancelled) setReport(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setReport(null)
          setError(e instanceof Error ? e.message : '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [staleDays, reloadKey])

  function refresh() {
    const n = Number.parseInt(staleInput, 10)
    setStaleDays(Number.isFinite(n) && n > 0 ? n : 90)
    setReloadKey((k) => k + 1)
  }

  const controls = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        marginBottom: 20,
      }}
    >
      <label style={{ ...labelStyle, gap: 10 }}>
        长期未更新阈值（天）
        <input
          type="number"
          min={1}
          value={staleInput}
          onChange={(e) => setStaleInput(e.target.value)}
          style={{ ...controlStyle, width: 90 }}
        />
      </label>
      <button style={btnSmall} onClick={refresh} disabled={loading}>
        {loading ? '刷新中...' : '刷新'}
      </button>
    </div>
  )

  if (loading) {
    return (
      <div style={cardStyle}>
        {controls}
        <p style={{ ...metaStyle, margin: 0 }}>加载中...</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div style={cardStyle}>
        {controls}
        <p style={{ color: colors.danger, margin: 0, fontSize: 13 }}>
          加载失败：{error ?? '无数据'}
        </p>
        <button style={{ ...btnSmall, marginTop: 12 }} onClick={() => setReloadKey((k) => k + 1)}>
          重试
        </button>
      </div>
    )
  }

  const t = report.totals
  const cards: { label: string; value: string }[] = [
    { label: '总会话', value: String(t.sessions) },
    { label: '已归档', value: String(t.archived) },
    { label: '孤儿子会话', value: String(t.orphanChildren) },
    { label: '孤儿 diff 文件', value: String(t.orphanDiffFiles) },
    { label: '空会话', value: String(t.emptySessions) },
    { label: '长期未更新', value: String(t.staleSessions) },
    { label: '受保护但已不存在', value: String(t.protectedMissing) },
  ]

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {controls}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} style={subCardStyle}>
            <div style={cardLabel}>{c.label}</div>
            <div style={cardValue}>{c.value}</div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 13, color: colors.secondary, margin: 0 }}>
        该扫描为只读检查，仅列出可能残留的会话与文件，不会删除或修改任何数据。点击标题可在会话列表中查看。
      </p>

      {report.orphanChildren.length > 0 ? (
        <div>
          <strong style={sectionTitleStyle}>
            孤儿子会话（{report.orphanChildren.length}）
          </strong>
          <table style={{ ...tableStyle, marginTop: 8 }}>
            <thead>
              <tr>
                <th style={thStyle}>标题</th>
                <th style={thStyle}>id</th>
                <th style={thStyle}>缺失父 id</th>
              </tr>
            </thead>
            <tbody>
              {report.orphanChildren.map((it: OrphanChild) => (
                <tr key={it.id}>
                  <td style={tdStyle}>
                    <span
                      className={onSelect ? linkClass : undefined}
                      onClick={onSelect ? () => onSelect(it.id) : undefined}
                    >
                      {it.title || it.id}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: colors.secondary, whiteSpace: 'nowrap' }}>
                    {it.id}
                  </td>
                  <td style={{ ...tdStyle, color: colors.danger, whiteSpace: 'nowrap' }}>
                    {it.parentID}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {report.orphanDiffFiles.length > 0 ? (
        <div>
          <strong style={sectionTitleStyle}>
            孤儿 diff 文件（{report.orphanDiffFiles.length}）
          </strong>
          <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, color: colors.secondary }}>
            {report.orphanDiffFiles.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.emptySessions.length > 0 ? (
        <div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <strong style={sectionTitleStyle}>
              空会话（无消息/占位）（{report.emptySessions.length}）
            </strong>
            {onBulkDelete ? (
              <button
                style={btnSmallDanger}
                onClick={() => onBulkDelete(report.emptySessions.map((it) => it.id))}
              >
                删除这些空会话
              </button>
            ) : null}
          </div>
          <ItemTable items={report.emptySessions} onSelect={onSelect} />
        </div>
      ) : null}

      {report.staleSessions.length > 0 ? (
        <div>
          <strong style={sectionTitleStyle}>长期未更新（{report.staleSessions.length}）</strong>
          <ItemTable items={report.staleSessions} onSelect={onSelect} />
        </div>
      ) : null}

      {report.protectedMissing.length > 0 ? (
        <div>
          <strong style={sectionTitleStyle}>
            受保护但已不存在（{report.protectedMissing.length}）
          </strong>
          <ul style={{ margin: '8px 0', paddingLeft: 20, fontSize: 13, color: colors.danger }}>
            {report.protectedMissing.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
