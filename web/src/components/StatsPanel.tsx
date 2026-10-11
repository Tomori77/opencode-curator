import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { getStats } from '../api'
import type { StatBucket, Stats, TopSession } from '../api'
import {
  btnSmall,
  cardStyle,
  colors,
  metaStyle,
  subCardStyle,
  tableStyle,
  tdStyle,
  thStyle,
} from '../ui'

interface StatsPanelProps {
  onSelect?: (id: string) => void
}

function formatCost(cost: number): string {
  return cost.toFixed(2)
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

function BarList({ title, items }: { title: string; items: StatBucket[] }) {
  const maxCount = items.reduce((m, it) => Math.max(m, it.count), 0)
  return (
    <div style={{ ...subCardStyle, flex: '1 1 280px', minWidth: 280 }}>
      <strong style={{ fontSize: 14, color: colors.text }}>{title}</strong>
      {items.length === 0 ? (
        <p style={{ ...metaStyle, margin: '8px 0' }}>暂无数据</p>
      ) : (
        <div style={{ marginTop: 10 }}>
          {items.map((it) => (
            <div key={it.value} style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: colors.text,
                  }}
                >
                  {it.value}
                </span>
                <span style={{ color: colors.secondary, whiteSpace: 'nowrap' }}>
                  {it.count} · ¥{formatCost(it.cost)} · {it.tokensIn + it.tokensOut} tokens
                </span>
              </div>
              <div style={{ background: colors.hairline, borderRadius: 999, height: 8, marginTop: 4 }}>
                <div
                  style={{
                    width: `${maxCount > 0 ? (it.count / maxCount) * 100 : 0}%`,
                    background: colors.accent,
                    height: 8,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TopTable({
  title,
  items,
  onSelect,
}: {
  title: string
  items: TopSession[]
  onSelect?: (id: string) => void
}) {
  return (
    <div style={{ ...subCardStyle, flex: '1 1 280px', minWidth: 280 }}>
      <strong style={{ fontSize: 14, color: colors.text }}>{title}</strong>
      {items.length === 0 ? (
        <p style={{ ...metaStyle, margin: '8px 0' }}>暂无数据</p>
      ) : (
        <table style={{ ...tableStyle, marginTop: 8 }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>标题</th>
              <th style={thStyle}>费用</th>
              <th style={thStyle}>Tokens (输入/输出)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr
                key={it.id}
                className={onSelect ? 'ui-row' : undefined}
                onClick={onSelect ? () => onSelect(it.id) : undefined}
                style={onSelect ? { cursor: 'pointer' } : undefined}
              >
                <td style={tdStyle}>{i + 1}</td>
                <td style={tdStyle}>{it.title}</td>
                <td style={tdStyle}>{formatCost(it.cost)}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                  {it.tokensIn} / {it.tokensOut}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export function StatsPanel({ onSelect }: StatsPanelProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getStats()
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setStats(null)
          setError(e instanceof Error ? e.message : '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  if (loading) {
    return (
      <div style={cardStyle}>
        <p style={{ ...metaStyle, margin: 0 }}>加载中...</p>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div style={cardStyle}>
        <p style={{ color: colors.danger, margin: 0, fontSize: 13 }}>
          加载失败：{error ?? '无数据'}
        </p>
        <button style={{ ...btnSmall, marginTop: 12 }} onClick={() => setReloadKey((k) => k + 1)}>
          重试
        </button>
      </div>
    )
  }

  const t = stats.totals
  const cards: { label: string; value: string }[] = [
    { label: '会话总数', value: String(t.sessions) },
    { label: '未归档', value: String(t.nonArchived) },
    { label: '已归档', value: String(t.archived) },
    { label: '总花费', value: formatCost(t.cost) },
    { label: '总输入 tokens', value: String(t.tokensIn) },
    { label: '总输出 tokens', value: String(t.tokensOut) },
    { label: '缓存读', value: String(t.cacheRead) },
  ]

  const maxMonthCount = stats.byMonth.reduce((m, it) => Math.max(m, it.count), 0)

  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} style={subCardStyle}>
            <div style={cardLabel}>{c.label}</div>
            <div style={cardValue}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <BarList title="按模型" items={stats.byModel} />
        <BarList title="按项目" items={stats.byProject} />
        <BarList title="按 Agent" items={stats.byAgent} />
      </div>

      <div>
        <strong style={{ fontSize: 14, color: colors.text }}>按月</strong>
        {stats.byMonth.length === 0 ? (
          <p style={{ ...metaStyle, margin: '8px 0' }}>暂无数据</p>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              marginTop: 12,
              overflowX: 'auto',
            }}
          >
            {stats.byMonth.map((m) => (
              <div key={m.month} style={{ textAlign: 'center', minWidth: 56 }}>
                <div style={{ fontSize: 11, color: colors.secondary }}>{m.count}</div>
                <div
                  style={{
                    height: maxMonthCount > 0 ? Math.max((m.count / maxMonthCount) * 120, 4) : 4,
                    background: colors.accent,
                    borderRadius: '6px 6px 0 0',
                    margin: '2px 8px',
                  }}
                />
                <div style={{ fontSize: 11, whiteSpace: 'nowrap', color: colors.text }}>
                  {m.month}
                </div>
                <div style={{ fontSize: 11, color: colors.secondary }}>¥{formatCost(m.cost)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <TopTable title="Tokens 排行" items={stats.topByTokens} onSelect={onSelect} />
        <TopTable title="花费排行" items={stats.topByCost} onSelect={onSelect} />
      </div>
    </div>
  )
}
