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

export interface SessionTime {
  created: number
  updated: number
  archived?: number
}

export interface Session {
  id: string
  slug: string
  projectID: string
  workspaceID?: string
  directory: string
  path?: string
  parentID?: string
  title: string
  agent?: string
  model?: SessionModel
  version: string
  summary?: SessionSummary
  cost: number
  tokens: SessionTokens
  time: SessionTime
  permission?: unknown
  revert?: unknown
  project?: { id: string; worktree: string }
  childCount?: number
}

export interface ExportBundle {
  info: Session
  messages: Message[]
}

export interface RestoreResult {
  sessionId: string
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

export interface SessionQuery {
  search?: string
  directory?: string
  projectId?: string
  roots?: boolean
  archived?: 'false' | 'true' | 'all'
  sort?: 'updated' | 'created' | 'cost' | 'tokens' | 'title' | 'directory'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface TreeQuery {
  archived?: 'false' | 'true' | 'all'
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

export interface PagedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface FacetBucket {
  value: string
  count: number
}

export interface Facets {
  directories: FacetBucket[]
  projects: FacetBucket[]
  models: FacetBucket[]
  agents: FacetBucket[]
  totals: { all: number; nonArchived: number; archived: number; roots: number }
}

export interface ListSessionsOptions {
  directory?: string
  workspace?: string
  scope?: string
  path?: string
  roots?: boolean
  start?: number
  search?: string
  limit?: number
}

export interface SessionPatch {
  title?: string
  metadata?: Record<string, unknown>
  time?: { archived?: number }
}

export interface BulkDeleteOptions {
  force?: boolean
  backup?: boolean
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
  mode?: string
  cost?: number
  tokens?: MessageTokens
  time?: { created?: number; completed?: number }
  finish?: string
  summary?: unknown
  error?: unknown
}

export interface PartBase {
  id: string
  sessionID: string
  messageID: string
  type: string
  time?: { start?: number; end?: number }
}

export interface TextPart extends PartBase {
  type: 'text'
  text: string
  synthetic?: boolean
}

export interface ReasoningPart extends PartBase {
  type: 'reasoning'
  text: string
}

export interface ToolPart extends PartBase {
  type: 'tool'
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

export interface StepPart extends PartBase {
  type: 'step-start' | 'step-finish'
}

export type MessagePart = TextPart | ReasoningPart | ToolPart | StepPart | PartBase

export interface Message {
  info: MessageInfo
  parts: MessagePart[]
}

export interface MessageQuery {
  limit?: number
  before?: string
}

export interface Todo {
  content: string
  status: string
  priority: string
  position: number
}

export interface SessionImpact {
  session: { id: string; title: string; directory: string; archived: boolean }
  messages: number
  parts: number
  children: number
  protected: boolean
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
