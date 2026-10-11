import { useEffect, useState } from 'react'
import type { ArchivedFilter, Facets, SessionSort, SortOrder } from '../api'
import { cardStyle, checkboxStyle, controlStyle, labelStyle } from '../ui'

interface FiltersProps {
  facets: Facets | null
  search: string
  directory: string
  projectId: string
  archived: ArchivedFilter
  roots: boolean
  sort: SessionSort
  order: SortOrder
  pageSize: number
  onSearch: (value: string) => void
  onDirectory: (value: string) => void
  onProjectId: (value: string) => void
  onArchived: (value: ArchivedFilter) => void
  onRoots: (value: boolean) => void
  onSort: (value: SessionSort) => void
  onOrder: (value: SortOrder) => void
  onPageSize: (value: number) => void
}

const sortOptions: SessionSort[] = ['updated', 'created', 'cost', 'tokens', 'title', 'directory']
const pageSizeOptions = [20, 50, 100, 200]

export function Filters(props: FiltersProps) {
  const [search, setSearch] = useState(props.search)

  useEffect(() => {
    const timer = window.setTimeout(() => props.onSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const directories = props.facets?.directories ?? []
  const projects = props.facets?.projects ?? []

  return (
    <div
      style={{
        ...cardStyle,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        marginBottom: 20,
      }}
    >
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索会话"
        style={{ ...controlStyle, flex: '1 1 220px', minWidth: 200 }}
      />
      <select
        value={props.directory}
        onChange={(e) => props.onDirectory(e.target.value)}
        style={controlStyle}
      >
        <option value="">全部目录</option>
        {directories.map((d) => (
          <option key={d.value} value={d.value}>
            {d.value} ({d.count})
          </option>
        ))}
      </select>
      <select
        value={props.projectId}
        onChange={(e) => props.onProjectId(e.target.value)}
        style={controlStyle}
      >
        <option value="">全部项目</option>
        {projects.map((p) => (
          <option key={p.value} value={p.value}>
            {p.value} ({p.count})
          </option>
        ))}
      </select>
      <select
        value={props.archived}
        onChange={(e) => props.onArchived(e.target.value as ArchivedFilter)}
        style={controlStyle}
      >
        <option value="all">全部</option>
        <option value="false">未归档</option>
        <option value="true">已归档</option>
      </select>
      <label style={labelStyle}>
        <input
          type="checkbox"
          style={checkboxStyle}
          checked={props.roots}
          onChange={(e) => props.onRoots(e.target.checked)}
        />
        仅根会话
      </label>
      <select
        value={props.sort}
        onChange={(e) => props.onSort(e.target.value as SessionSort)}
        style={controlStyle}
      >
        {sortOptions.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={props.order}
        onChange={(e) => props.onOrder(e.target.value as SortOrder)}
        style={controlStyle}
      >
        <option value="desc">降序</option>
        <option value="asc">升序</option>
      </select>
      <select
        value={props.pageSize}
        onChange={(e) => props.onPageSize(Number(e.target.value))}
        style={controlStyle}
      >
        {pageSizeOptions.map((n) => (
          <option key={n} value={n}>
            {n} / 页
          </option>
        ))}
      </select>
    </div>
  )
}
