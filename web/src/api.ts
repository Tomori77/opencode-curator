export interface SessionModel {
  id: string
  providerID: string
  variant?: string
}

export interface SessionTokens {
  input: number
  output: number
  reasoning: number
  cache: { read: number; write: number }
}

export interface SessionSummary {
  additions: number
  deletions: number
  files: number
}

export interface SessionProject {
  id: string
  worktree: string
}

export interface Session {
  id: string
  slug: string
  projectID: string
  directory: string
  path?: string
  parentID?: string
  childCount?: number
  title: string
  agent?: string
  model?: SessionModel
  version: string
  summary?: SessionSummary
  cost: number
  tokens: SessionTokens
  time: { created: number; updated: number; archived?: number }
  project?: SessionProject
}

export type ArchivedFilter = 'all' | 'false' | 'true'
export type SessionSort = 'updated' | 'created' | 'cost' | 'tokens' | 'title' | 'directory'
export type SortOrder = 'asc' | 'desc'

export interface SessionQuery {
  search?: string
  directory?: string
  projectId?: string
  roots?: boolean
  archived?: ArchivedFilter
  sort?: SessionSort
  order?: SortOrder
  page?: number
  pageSize?: number
}

export interface PagedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface TreeQuery {
  archived?: ArchivedFilter
  search?: string
}

export interface TreeNode {
  id: string
  title: string
  directory: string
  agent?: string
  model?: string
  cost: number
  tokensIn: number
  tokensOut: number
  archived: boolean
  updated: number
  children: TreeNode[]
}

export interface FacetValue {
  value: string
  count: number
}

export interface Facets {
  directories: FacetValue[]
  projects: FacetValue[]
  models: FacetValue[]
  agents: FacetValue[]
  totals: { all: number; nonArchived: number; archived: number; roots: number }
}

export interface Health {
  ok: boolean
  service: string
  opencode: { url: string; reachable: boolean; error?: string }
}

export interface HealthItem {
  id: string
  title: string
  directory: string
  updated: number
  archived: boolean
}

export interface OrphanChild {
  id: string
  title: string
  parentID: string
}

export interface HealthReport {
  totals: {
    sessions: number
    archived: number
    orphanChildren: number
    orphanDiffFiles: number
    emptySessions: number
    staleSessions: number
    protectedMissing: number
  }
  orphanChildren: OrphanChild[]
  orphanDiffFiles: string[]
  emptySessions: HealthItem[]
  staleSessions: HealthItem[]
  protectedMissing: string[]
}

export interface StatBucket {
  value: string
  count: number
  cost: number
  tokensIn: number
  tokensOut: number
}

export interface MonthStat {
  month: string
  count: number
  cost: number
  tokensIn: number
  tokensOut: number
}

export interface TopSession {
  id: string
  title: string
  cost: number
  tokensIn: number
  tokensOut: number
}

export interface Stats {
  totals: {
    sessions: number
    archived: number
    nonArchived: number
    cost: number
    tokensIn: number
    tokensOut: number
    tokensReasoning: number
    cacheRead: number
    cacheWrite: number
  }
  byModel: StatBucket[]
  byProject: StatBucket[]
  byAgent: StatBucket[]
  byMonth: MonthStat[]
  topByTokens: TopSession[]
  topByCost: TopSession[]
}

export interface MessageModel {
  providerID: string
  modelID: string
}

export interface MessageTokens {
  total?: number
  input: number
  output: number
  reasoning: number
  cache?: { read: number; write: number }
}

export interface MessageInfo {
  id: string
  sessionID: string
  role: 'user' | 'assistant'
  parentID?: string
  agent?: string
  model?: MessageModel
  cost?: number
  tokens?: MessageTokens
  time?: { created: number; completed?: number }
  finish?: string
}

export interface TextPart {
  id: string
  sessionID: string
  messageID: string
  type: 'text'
  time?: { start?: number; end?: number }
  text: string
}

export interface ReasoningPart {
  id: string
  sessionID: string
  messageID: string
  type: 'reasoning'
  time?: { start?: number; end?: number }
  text: string
}

export interface ToolPart {
  id: string
  sessionID: string
  messageID: string
  type: 'tool'
  time?: { start?: number; end?: number }
  tool: string
  callID: string
  state: {
    status: string
    input?: unknown
    output?: string
    metadata?: unknown
    title?: string
    time?: { start?: number; end?: number }
  }
}

export interface StepPart {
  id: string
  sessionID: string
  messageID: string
  type: 'step-start' | 'step-finish'
  time?: { start?: number; end?: number }
}

export type MessagePart = TextPart | ReasoningPart | ToolPart | StepPart

export interface Message {
  info: MessageInfo
  parts: MessagePart[]
}

export interface Todo {
  content: string
  status: string
  priority: string
  position: number
}

export interface MessagesResult {
  data: Message[]
}

export interface TodosResult {
  data: Todo[]
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

function buildQuery(query: SessionQuery): string {
  const params = new URLSearchParams()
  if (query.search) params.set('search', query.search)
  if (query.directory) params.set('directory', query.directory)
  if (query.projectId) params.set('projectId', query.projectId)
  if (query.roots) params.set('roots', 'true')
  if (query.archived) params.set('archived', query.archived)
  if (query.sort) params.set('sort', query.sort)
  if (query.order) params.set('order', query.order)
  if (query.page != null) params.set('page', String(query.page))
  if (query.pageSize != null) params.set('pageSize', String(query.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function getHealth(): Promise<Health> {
  return request<Health>('/api/health')
}

export function getHealthReport(staleDays = 90): Promise<HealthReport> {
  const params = new URLSearchParams()
  params.set('staleDays', String(staleDays))
  return request<HealthReport>(`/api/health/report?${params.toString()}`)
}

export function listSessions(query: SessionQuery = {}): Promise<PagedResult<Session>> {
  return request<PagedResult<Session>>(`/api/sessions${buildQuery(query)}`)
}

export function getFacets(): Promise<Facets> {
  return request<Facets>('/api/sessions/facets')
}

export function getTree(query: TreeQuery = {}): Promise<TreeNode[]> {
  const params = new URLSearchParams()
  if (query.archived) params.set('archived', query.archived)
  if (query.search) params.set('search', query.search)
  const qs = params.toString()
  return request<{ data: TreeNode[] }>(`/api/sessions/tree${qs ? `?${qs}` : ''}`).then(
    (r) => r.data,
  )
}

export function getStats(): Promise<Stats> {
  return request<Stats>('/api/sessions/stats')
}

export function getSession(id: string): Promise<Session> {
  return request<Session>(`/api/sessions/${encodeURIComponent(id)}`)
}

export function getChildren(id: string): Promise<Session[]> {
  return request<{ data: Session[] }>(
    `/api/sessions/${encodeURIComponent(id)}/children`,
  ).then((r) => r.data)
}

export function getMessages(
  id: string,
  opts: { limit?: number; before?: string } = {},
): Promise<MessagesResult> {
  const params = new URLSearchParams()
  if (opts.limit != null) params.set('limit', String(opts.limit))
  if (opts.before) params.set('before', opts.before)
  const qs = params.toString()
  return request<MessagesResult>(
    `/api/sessions/${encodeURIComponent(id)}/messages${qs ? `?${qs}` : ''}`,
  )
}

export function getTodos(id: string): Promise<TodosResult> {
  return request<TodosResult>(`/api/sessions/${encodeURIComponent(id)}/todos`)
}

export function updateSession(
  id: string,
  patch: { title?: string; archived?: number },
): Promise<Session> {
  const body: { title?: string; time?: { archived: number } } = {}
  if (patch.title !== undefined) body.title = patch.title
  if (patch.archived !== undefined) body.time = { archived: patch.archived }
  return request<Session>(`/api/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function archiveSession(id: string): Promise<Session> {
  return updateSession(id, { archived: Date.now() })
}

export interface SessionImpact {
  session: { id: string; title: string; directory: string; archived: boolean }
  messages: number
  parts: number
  children: number
  protected: boolean
}

export class ProtectedError extends Error {
  constructor(message = 'protected') {
    super(message)
    this.name = 'ProtectedError'
  }
}

export function getImpact(id: string): Promise<SessionImpact> {
  return request<{ data: SessionImpact }>(
    `/api/sessions/${encodeURIComponent(id)}/impact`,
  ).then((r) => r.data)
}

export function deleteSession(id: string, force = false): Promise<void> {
  const qs = `?force=${force ? 'true' : 'false'}`
  return fetch(`/api/sessions/${encodeURIComponent(id)}${qs}`, { method: 'DELETE' }).then(
    async (res) => {
      if (res.ok) return undefined
      let body: { error?: string; protected?: boolean } = {}
      try {
        body = (await res.json()) as { error?: string; protected?: boolean }
      } catch {
        body = {}
      }
      if (res.status === 409 && body.protected) {
        throw new ProtectedError(body.error ?? 'protected')
      }
      if (res.status === 404) {
        const err = new Error(body.error ?? `${res.status} ${res.statusText}`)
        ;(err as { notFound?: boolean }).notFound = true
        throw err
      }
      throw new Error(body.error ?? `${res.status} ${res.statusText}`)
    },
  )
}

export interface BackupInfo {
  name: string
  size: number
  mtime: number
  sessionId?: string
  title?: string
  directory?: string
  sessionCreated?: number
  messageCount?: number
}

export function exportSessionUrl(id: string): string {
  return `/api/sessions/${encodeURIComponent(id)}/export`
}

export function backupSession(id: string): Promise<BackupInfo> {
  return request<{ data: BackupInfo }>(`/api/sessions/${encodeURIComponent(id)}/backup`, {
    method: 'POST',
  }).then((r) => r.data)
}

export function getBackups(): Promise<BackupInfo[]> {
  return request<{ data: BackupInfo[] }>('/api/backups').then((r) => r.data)
}

export function deleteBackup(name: string): Promise<void> {
  return request<{ ok: true }>(`/api/backups/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  }).then(() => undefined)
}

export function restoreBackup(name: string): Promise<{ sessionId: string }> {
  return request<{ data: { sessionId: string } }>(
    `/api/backups/${encodeURIComponent(name)}/restore`,
    { method: 'POST' },
  ).then((r) => r.data)
}

export function getProtected(): Promise<string[]> {
  return request<{ data: string[] }>('/api/protected').then((r) => r.data)
}

export function protectSession(id: string): Promise<void> {
  return request<{ ok: true }>('/api/protected', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }).then(() => undefined)
}

export function unprotectSession(id: string): Promise<void> {
  return request<{ ok: true }>(`/api/protected/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(() => undefined)
}

export interface BulkDeleteItemResult {
  id: string
  ok: boolean
  protected?: boolean
  backupName?: string
  error?: string
}

export interface BulkDeleteResult {
  results: BulkDeleteItemResult[]
  deleted: number
  failed: number
  skippedProtected: number
  backedUp: number
  notFound: number
}

export function bulkDelete(
  ids: string[],
  options: { force?: boolean; backup?: boolean } = {},
): Promise<BulkDeleteResult> {
  return request<{ data: BulkDeleteResult }>('/api/sessions/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, force: options.force, backup: options.backup }),
  }).then((r) => r.data)
}
