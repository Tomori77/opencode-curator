import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { getTree } from '../api'
import type { ArchivedFilter, TreeNode } from '../api'
import { btnSmall, cardStyle, colors, controlStyle, linkClass, pillAccent, pillNeutral } from '../ui'

interface ForkTreeProps {
  onSelect?: (id: string) => void
}

function formatCost(cost: number): string {
  return cost.toFixed(4)
}

const toggleButton: CSSProperties = {
  width: 20,
  height: 20,
  lineHeight: '16px',
  padding: 0,
  marginRight: 6,
  cursor: 'pointer',
  fontSize: 11,
  flex: '0 0 auto',
  border: `1px solid ${colors.hairline}`,
  borderRadius: 6,
  background: colors.card,
  color: colors.secondary,
}

function collectExpandable(nodes: TreeNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.children.length > 0) ids.push(node.id)
    ids.push(...collectExpandable(node.children))
  }
  return ids
}

function collectRoots(nodes: TreeNode[]): string[] {
  return nodes.filter((node) => node.children.length > 0).map((node) => node.id)
}

interface TreeRowProps {
  node: TreeNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  onSelect?: (id: string) => void
}

function TreeRow({ node, depth, expanded, onToggle, onSelect }: TreeRowProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 6,
          padding: '7px 0',
          paddingLeft: depth * 20,
          borderBottom: `1px solid ${colors.hairline}`,
        }}
      >
        {hasChildren ? (
          <button style={toggleButton} onClick={() => onToggle(node.id)}>
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ ...toggleButton, visibility: 'hidden', border: 'none' }} />
        )}
        <span
          className={linkClass}
          onClick={onSelect ? () => onSelect(node.id) : undefined}
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 320,
          }}
        >
          {node.title || node.id}
        </span>
        <span style={{ color: colors.secondary, fontSize: 12 }}>[{node.directory}]</span>
        <span style={{ color: colors.text, fontSize: 12 }}>{node.model ?? '—'}</span>
        <span style={{ color: colors.secondary, fontSize: 12, whiteSpace: 'nowrap' }}>
          {node.tokensIn + node.tokensOut} tokens · ¥{formatCost(node.cost)}
        </span>
        {node.archived ? <span style={pillNeutral}>已归档</span> : null}
        {hasChildren ? <span style={pillAccent}>子会话 {node.children.length}</span> : null}
      </div>
      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  )
}

export function ForkTree({ onSelect }: ForkTreeProps) {
  const [archived, setArchived] = useState<ArchivedFilter>('false')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [tree, setTree] = useState<TreeNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getTree({ archived, search: search || undefined })
      .then((data) => {
        if (!cancelled) {
          setTree(data)
          setExpanded(new Set(collectRoots(data)))
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setTree([])
          setExpanded(new Set())
          setError(e instanceof Error ? e.message : '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [archived, search, reloadKey])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function expandAll() {
    setExpanded(new Set(collectExpandable(tree)))
  }

  function collapseAll() {
    setExpanded(new Set())
  }

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <select
          value={archived}
          onChange={(e) => setArchived(e.target.value as ArchivedFilter)}
          style={controlStyle}
        >
          <option value="false">未归档</option>
          <option value="true">已归档</option>
          <option value="all">全部</option>
        </select>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索会话"
          style={{ ...controlStyle, flex: '1 1 220px', minWidth: 200 }}
        />
        <button style={btnSmall} onClick={expandAll}>
          展开全部
        </button>
        <button style={btnSmall} onClick={collapseAll}>
          折叠全部
        </button>
      </div>

      {loading ? <p style={{ color: colors.secondary, margin: 0, fontSize: 13 }}>加载中...</p> : null}

      {!loading && error ? (
        <div>
          <p style={{ color: colors.danger, margin: 0, fontSize: 13 }}>加载失败：{error}</p>
          <button style={{ ...btnSmall, marginTop: 12 }} onClick={() => setReloadKey((k) => k + 1)}>
            重试
          </button>
        </div>
      ) : null}

      {!loading && !error && tree.length === 0 ? (
        <p style={{ color: colors.secondary, margin: 0, fontSize: 13 }}>无会话</p>
      ) : null}

      {!loading && !error
        ? tree.map((node) => (
            <TreeRow
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  )
}
