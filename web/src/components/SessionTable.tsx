import { Fragment, useState } from 'react'
import { getChildren } from '../api'
import type { Session } from '../api'
import {
  btnSmall,
  btnSmallDanger,
  checkboxStyle,
  colors,
  linkClass,
  pillAccent,
  pillNeutral,
  rowCardStyle,
  rowClass,
  rowMainStyle,
  rowMetaStyle,
  rowStyle,
  rowTitleLineStyle,
  rowTitleStyle,
  rowTrailingStyle,
  sessionHeaderStyle,
  sessionListStyle,
} from '../ui'

interface SessionTableProps {
  sessions: Session[]
  onSelect?: (id: string) => void
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
  onToggleProtect?: (id: string) => void
  protectedIds?: Set<string>
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
  onToggleSelectAll?: (ids: string[], selected: boolean) => void
  openId?: string | null
}

function formatCost(cost: number | undefined): string {
  if (typeof cost !== 'number' || !cost) return '0'
  return cost.toFixed(4)
}

export function SessionTable({
  sessions,
  onSelect,
  onArchive,
  onDelete,
  onToggleProtect,
  protectedIds,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  openId,
}: SessionTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [childrenCache, setChildrenCache] = useState<Map<string, Session[]>>(new Map())
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

  const hasActions = Boolean(onArchive || onDelete || onToggleProtect)
  const hasSelect = Boolean(onToggleSelect || onToggleSelectAll)
  const allSelected = sessions.length > 0 && sessions.every((s) => selectedIds?.has(s.id))

  function fetchChildren(id: string) {
    setLoadingIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    setErrors((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    getChildren(id)
      .then((children) => {
        setChildrenCache((prev) => {
          const next = new Map(prev)
          next.set(id, children)
          return next
        })
      })
      .catch((e: unknown) => {
        setErrors((prev) => {
          const next = new Map(prev)
          next.set(id, e instanceof Error ? e.message : '加载失败')
          return next
        })
      })
      .finally(() => {
        setLoadingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      })
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    if (!childrenCache.has(id) && !loadingIds.has(id)) fetchChildren(id)
  }

  function renderRow(s: Session) {
    const isProtected = protectedIds?.has(s.id) ?? false
    const isSelected = selectedIds?.has(s.id) ?? false
    const isOpen = openId === s.id
    const canExpand = !s.parentID && (s.childCount ?? 0) > 0
    const isExpanded = expanded.has(s.id)
    return (
      <div
        key={s.id}
        className={rowClass}
        onClick={onToggleSelect ? () => onToggleSelect(s.id) : undefined}
        style={{ ...rowCardStyle, ...rowStyle(isSelected, isOpen) }}
      >
        {hasSelect ? (
          <div style={{ display: 'flex', alignItems: 'center', paddingTop: 2 }}>
            {onToggleSelect ? (
              <input
                type="checkbox"
                style={checkboxStyle}
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={() => onToggleSelect(s.id)}
              />
            ) : null}
          </div>
        ) : null}

        <div style={rowMainStyle}>
          <div style={rowTitleLineStyle}>
            <span
              className={linkClass}
              style={rowTitleStyle}
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(s.id)
              }}
            >
              {s.title}
            </span>
            {canExpand ? (
              <button
                style={{ ...pillAccent, border: 'none', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleExpand(s.id)
                }}
              >
                {isExpanded ? '▾' : '▸'} 子代理 {s.childCount}
              </button>
            ) : null}
            {s.parentID ? <span style={pillAccent}>分支</span> : null}
            {s.time.archived ? <span style={pillNeutral}>已归档</span> : null}
            {isProtected ? <span style={pillNeutral}>🔒 已保护</span> : null}
          </div>
          <div style={rowMetaStyle}>
            目录：{s.directory} · 模型：{s.model?.id ?? '—'} · Agent：{s.agent ?? '—'} ·
            Worktree：{s.project?.worktree ?? '—'}
          </div>
        </div>

        <div style={rowTrailingStyle}>
          <span>{new Date(s.time.updated).toLocaleString()}</span>
          <span>费用 {formatCost(s.cost)}</span>
          <span>
            Tokens {s.tokens?.input ?? 0}/{s.tokens?.output ?? 0}
          </span>
          {hasActions ? (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {onArchive ? (
                s.time.archived ? (
                  <span style={pillNeutral}>已归档</span>
                ) : (
                  <button
                    style={btnSmall}
                    onClick={(e) => {
                      e.stopPropagation()
                      onArchive(s.id)
                    }}
                  >
                    归档
                  </button>
                )
              ) : null}
              {onToggleProtect ? (
                <button
                  style={btnSmall}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleProtect(s.id)
                  }}
                >
                  {isProtected ? '取消保护' : '保护'}
                </button>
              ) : null}
              {onDelete ? (
                <button
                  style={btnSmallDanger}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(s.id)
                  }}
                >
                  删除
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div style={sessionListStyle}>
      {hasSelect ? (
        <div style={sessionHeaderStyle}>
          {onToggleSelectAll ? (
            <input
              type="checkbox"
              style={checkboxStyle}
              checked={allSelected}
              onChange={(e) =>
                onToggleSelectAll(
                  sessions.map((s) => s.id),
                  e.target.checked,
                )
              }
            />
          ) : null}
          <span>全选</span>
          <span style={{ marginLeft: 'auto' }}>
            {selectedIds?.size ? `已选 ${selectedIds.size} 个` : null}
          </span>
        </div>
      ) : null}

      {sessions.map((s) => {
        const showChildren = !s.parentID && (s.childCount ?? 0) > 0 && expanded.has(s.id)
        const children = childrenCache.get(s.id)
        const isLoading = loadingIds.has(s.id)
        const error = errors.get(s.id)
        return (
          <Fragment key={s.id}>
            {renderRow(s)}
            {showChildren ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginLeft: 6,
                  paddingLeft: 12,
                  borderLeft: `2px solid ${colors.hairline}`,
                }}
              >
                {isLoading && !children ? (
                  <p style={{ margin: 0, fontSize: 12, color: colors.secondary }}>
                    加载中…
                  </p>
                ) : null}
                {error ? (
                  <p style={{ margin: 0, fontSize: 12, color: colors.danger }}>
                    加载失败：{error}
                    <button
                      style={{ ...btnSmall, marginLeft: 8 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        fetchChildren(s.id)
                      }}
                    >
                      重试
                    </button>
                  </p>
                ) : null}
                {children && children.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: colors.secondary }}>
                    无子代理
                  </p>
                ) : null}
                {children?.map((c) => renderRow(c))}
              </div>
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}
