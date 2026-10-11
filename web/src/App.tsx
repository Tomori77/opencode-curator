import { useEffect, useState } from 'react'
import {
  archiveSession,
  getFacets,
  getHealth,
  getProtected,
  listSessions,
  protectSession,
  unprotectSession,
} from './api'
import type {
  ArchivedFilter,
  Facets,
  Health,
  PagedResult,
  Session,
  SessionSort,
  SortOrder,
} from './api'
import { BackupsPanel } from './components/BackupsPanel'
import { BulkDeleteDialog } from './components/BulkDeleteDialog'
import { ConfirmDelete } from './components/ConfirmDelete'
import { Filters } from './components/Filters'
import { ForkTree } from './components/ForkTree'
import { HealthPanel } from './components/HealthPanel'
import { Pagination } from './components/Pagination'
import { SessionDetail } from './components/SessionDetail'
import { SessionTable } from './components/SessionTable'
import { StatsPanel } from './components/StatsPanel'
import {
  appStyle,
  btnSmall,
  cardStyle,
  colors,
  containerStyle,
  detailAsideStyle,
  dotStyle,
  globalCss,
  segmentedStyle,
  segmentStyle,
  selectionBarStyle,
  subtitleStyle,
  titleBarStyle,
  titleStyle,
} from './ui'

type View = 'list' | 'stats' | 'backups' | 'tree' | 'health'

const viewItems: { key: View; label: string }[] = [
  { key: 'list', label: '会话' },
  { key: 'stats', label: '统计' },
  { key: 'backups', label: '备份' },
  { key: 'tree', label: '分支' },
  { key: 'health', label: '健康' },
]

export function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [healthChecked, setHealthChecked] = useState(false)
  const [facets, setFacets] = useState<Facets | null>(null)
  const [result, setResult] = useState<PagedResult<Session> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [directory, setDirectory] = useState('')
  const [projectId, setProjectId] = useState('')
  const [archived, setArchived] = useState<ArchivedFilter>('all')
  const [roots, setRoots] = useState(true)
  const [sort, setSort] = useState<SessionSort>('updated')
  const [order, setOrder] = useState<SortOrder>('desc')
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [protectedIds, setProtectedIds] = useState<Set<string>>(new Set())
  const [protectedKey, setProtectedKey] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkIds, setBulkIds] = useState<string[] | null>(null)
  const [view, setView] = useState<View>('list')

  useEffect(() => {
    getHealth()
      .then((h) => setHealth(h))
      .catch(() => setHealth(null))
      .finally(() => setHealthChecked(true))
  }, [])

  useEffect(() => {
    let cancelled = false
    getProtected()
      .then((ids) => {
        if (!cancelled) setProtectedIds(new Set(ids))
      })
      .catch(() => {
        if (!cancelled) setProtectedIds(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [protectedKey])

  useEffect(() => {
    getFacets()
      .then((f) => setFacets(f))
      .catch(() => setFacets(null))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listSessions({
      search,
      directory: directory || undefined,
      projectId: projectId || undefined,
      archived,
      roots,
      sort,
      order,
      page,
      pageSize,
    })
      .then((r) => {
        if (!cancelled) setResult(r)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setResult(null)
          setError(e instanceof Error ? e.message : '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [search, directory, projectId, archived, roots, sort, order, page, pageSize, reloadKey])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [search, directory, projectId, archived, roots, sort, order, page, pageSize])

  function changeSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function changeDirectory(value: string) {
    setDirectory(value)
    setPage(1)
  }

  function changeProjectId(value: string) {
    setProjectId(value)
    setPage(1)
  }

  function changeArchived(value: ArchivedFilter) {
    setArchived(value)
    setPage(1)
  }

  function changeRoots(value: boolean) {
    setRoots(value)
    setPage(1)
  }

  function changeSort(value: SessionSort) {
    setSort(value)
    setPage(1)
  }

  function changeOrder(value: SortOrder) {
    setOrder(value)
    setPage(1)
  }

  function changePageSize(value: number) {
    setPageSize(value)
    setPage(1)
  }

  function handleArchive(id: string) {
    archiveSession(id)
      .then(() => setReloadKey((k) => k + 1))
      .catch(() => {})
  }

  function handleDelete(id: string) {
    setDeleteId(id)
  }

  function handleToggleProtect(id: string) {
    const action = protectedIds.has(id) ? unprotectSession(id) : protectSession(id)
    action
      .then(() => setProtectedKey((k) => k + 1))
      .catch(() => {})
  }

  function handleDeleted() {
    const id = deleteId
    setDeleteId(null)
    if (id && selectedId === id) setSelectedId(null)
    setReloadKey((k) => k + 1)
    setProtectedKey((k) => k + 1)
  }

  function handleStatsSelect(id: string) {
    setSelectedId(id)
    setView('list')
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleToggleSelectAll(ids: string[], selected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => {
        if (selected) next.add(id)
        else next.delete(id)
      })
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function handleBulkDone() {
    setBulkIds(null)
    setSelectedIds(new Set())
    setReloadKey((k) => k + 1)
    setProtectedKey((k) => k + 1)
  }

  const totals = facets?.totals
  const sessions = result?.data ?? []

  let healthText = '检测中...'
  let healthColor = colors.secondary
  if (healthChecked) {
    if (!health) {
      healthText = '服务不可用'
      healthColor = colors.danger
    } else if (health.opencode.reachable) {
      healthText = 'opencode 可达'
      healthColor = colors.success
    } else {
      healthText = `opencode 不可达${health.opencode.error ? `（${health.opencode.error}）` : ''}`
      healthColor = colors.danger
    }
  }

  return (
    <main style={appStyle}>
      <style>{globalCss}</style>
      <div style={containerStyle}>
        <header style={titleBarStyle}>
          <div>
            <h1 style={titleStyle}>opencode-curator</h1>
            <div style={subtitleStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={dotStyle(healthColor)} />
                {healthText}
              </span>
              {totals ? (
                <span>
                  全部 {totals.all} · 未归档 {totals.nonArchived} · 已归档 {totals.archived} · 根会话{' '}
                  {totals.roots}
                </span>
              ) : null}
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div style={segmentedStyle}>
              {viewItems.map((item) => (
                <button
                  key={item.key}
                  className="ui-seg"
                  style={segmentStyle(view === item.key)}
                  onClick={() => setView(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {view === 'backups' ? <BackupsPanel onRestored={handleStatsSelect} /> : null}

        {view === 'stats' ? <StatsPanel onSelect={handleStatsSelect} /> : null}

        {view === 'tree' ? <ForkTree onSelect={handleStatsSelect} /> : null}

        {view === 'health' ? (
          <HealthPanel onSelect={handleStatsSelect} onBulkDelete={(ids) => setBulkIds(ids)} />
        ) : null}

        {view === 'list' ? (
          <>
            <Filters
              facets={facets}
              search={search}
              directory={directory}
              projectId={projectId}
              archived={archived}
              roots={roots}
              sort={sort}
              order={order}
              pageSize={pageSize}
              onSearch={changeSearch}
              onDirectory={changeDirectory}
              onProjectId={changeProjectId}
              onArchived={changeArchived}
              onRoots={changeRoots}
              onSort={changeSort}
              onOrder={changeOrder}
              onPageSize={changePageSize}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={cardStyle}>
                  {loading ? (
                    <p style={{ color: colors.secondary, margin: 0, fontSize: 13 }}>加载中...</p>
                  ) : null}

                  {!loading && error ? (
                    <div>
                      <p style={{ color: colors.danger, margin: 0, fontSize: 13 }}>
                        加载失败：{error}
                      </p>
                      <button
                        style={{ ...btnSmall, marginTop: 12 }}
                        onClick={() => setReloadKey((k) => k + 1)}
                      >
                        重试
                      </button>
                    </div>
                  ) : null}

                  {!loading && !error && sessions.length === 0 ? (
                    <p style={{ color: colors.secondary, margin: 0, fontSize: 13 }}>无会话</p>
                  ) : null}

                  {!loading && !error && sessions.length > 0 ? (
                    <>
                      {selectedIds.size > 0 ? (
                        <div style={selectionBarStyle}>
                          <span>已选 {selectedIds.size} 个</span>
                          <button
                            style={{ ...btnSmall, color: colors.danger, borderColor: 'rgba(255,59,48,0.35)' }}
                            onClick={() =>
                              setBulkIds(
                                sessions.filter((s) => selectedIds.has(s.id)).map((s) => s.id),
                              )
                            }
                          >
                            删除选中
                          </button>
                          <button style={btnSmall} onClick={clearSelection}>
                            清空选择
                          </button>
                        </div>
                      ) : null}
                      <SessionTable
                        sessions={sessions}
                        onSelect={setSelectedId}
                        onArchive={handleArchive}
                        onDelete={handleDelete}
                        onToggleProtect={handleToggleProtect}
                        protectedIds={protectedIds}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        onToggleSelectAll={handleToggleSelectAll}
                        openId={selectedId}
                      />
                      <Pagination
                        page={result?.page ?? 1}
                        pageCount={result?.pageCount ?? 1}
                        onPage={setPage}
                      />
                      <p style={{ fontSize: 12, color: colors.secondary, marginBottom: 0 }}>
                        共 {result?.total ?? 0} 条
                      </p>
                    </>
                  ) : null}
                </div>
              </div>

              <aside style={detailAsideStyle}>
                {selectedId ? (
                  <SessionDetail
                    sessionId={selectedId}
                    onClose={() => setSelectedId(null)}
                    onUpdated={() => setReloadKey((k) => k + 1)}
                    onDelete={() => handleDelete(selectedId)}
                    onToggleProtect={() => handleToggleProtect(selectedId)}
                    protected={protectedIds.has(selectedId)}
                  />
                ) : (
                  <div
                    style={{
                      ...cardStyle,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      padding: '48px 24px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
                      选择左侧会话查看详情
                    </div>
                    <div style={{ fontSize: 13, color: colors.secondary }}>
                      点击会话标题即可打开右侧详情面板
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </>
        ) : null}

        {deleteId ? (
          <ConfirmDelete
            sessionId={deleteId}
            onClose={() => setDeleteId(null)}
            onDeleted={handleDeleted}
          />
        ) : null}

        {bulkIds ? (
          <BulkDeleteDialog
            ids={bulkIds}
            titles={sessions.filter((s) => bulkIds.includes(s.id)).map((s) => `${s.title} (${s.id})`)}
            onClose={() => setBulkIds(null)}
            onDone={handleBulkDone}
          />
        ) : null}
      </div>
    </main>
  )
}
