import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { OpencodeClient } from '../opencode/client'
import type {
  BackupInfo,
  BulkDeleteOptions,
  BulkDeleteItemResult,
  BulkDeleteResult,
  ExportBundle,
  FacetBucket,
  Facets,
  HealthItem,
  HealthReport,
  ListSessionsOptions,
  Message,
  MessageQuery,
  MonthStat,
  OrphanChild,
  PagedResult,
  RestoreResult,
  Session,
  SessionImpact,
  SessionPatch,
  SessionQuery,
  StatBucket,
  Stats,
  Todo,
  TopSession,
  TreeQuery,
  TreeNode,
} from '../opencode/types'
import type { ProtectedStore } from '../store/protected-store'
import { OpencodeRequestError } from '../opencode/http-client'
import { config } from '../config'

export class SessionProtectedError extends Error {
  constructor(id: string) {
    super(`session ${id} is protected`)
    this.name = 'SessionProtectedError'
  }
}

export class SessionGoneError extends Error {
  constructor(public readonly id: string) {
    super(`session gone: ${id}`)
    this.name = 'SessionGoneError'
  }
}

export class SessionService {
  constructor(
    private readonly client: OpencodeClient,
    private readonly store: ProtectedStore,
  ) {}

  list(options: ListSessionsOptions): Promise<Session[]> {
    return this.client.listSessions(options)
  }

  async query(q: SessionQuery): Promise<PagedResult<Session>> {
    const all = await this.client.listAllSessions()
    const filtered = all.filter((session) => this.matches(session, q))
    const sorted = this.sort(filtered, q)
    const pageSize = Math.min(Math.max(Math.trunc(q.pageSize ?? 50), 1), 500)
    const page = Math.max(Math.trunc(q.page ?? 1), 1)
    const total = sorted.length
    const pageCount = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const pageItems = sorted.slice(start, start + pageSize)
    const childCounts = new Map<string, number>()
    for (const session of all) {
      if (session.parentID) {
        childCounts.set(session.parentID, (childCounts.get(session.parentID) ?? 0) + 1)
      }
    }
    for (const session of pageItems) {
      session.childCount = childCounts.get(session.id) ?? 0
    }
    return {
      data: pageItems,
      total,
      page,
      pageSize,
      pageCount,
    }
  }

  async tree(q: TreeQuery): Promise<TreeNode[]> {
    const all = await this.client.listAllSessions()
    const filtered = all.filter((session) => this.treeMatches(session, q))
    const nodes = new Map<string, TreeNode>()
    for (const session of filtered) {
      nodes.set(session.id, {
        id: session.id,
        title: session.title,
        directory: session.directory,
        agent: session.agent,
        model: session.model?.id,
        cost: session.cost,
        tokensIn: session.tokens.input,
        tokensOut: session.tokens.output,
        archived: session.time.archived != null,
        updated: session.time.updated,
        children: [],
      })
    }
    const roots: TreeNode[] = []
    for (const session of filtered) {
      const node = nodes.get(session.id)
      if (!node) continue
      const parent = session.parentID ? nodes.get(session.parentID) : undefined
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
    const byUpdatedDesc = (a: TreeNode, b: TreeNode): number => b.updated - a.updated
    roots.sort(byUpdatedDesc)
    for (const node of nodes.values()) node.children.sort(byUpdatedDesc)
    return roots
  }

  private treeMatches(session: Session, q: TreeQuery): boolean {
    const archived = q.archived ?? 'false'
    if (archived === 'false' && session.time.archived != null) {
      return false
    }
    if (archived === 'true' && session.time.archived == null) {
      return false
    }
    if (q.search) {
      const needle = q.search.toLowerCase()
      const haystack = [session.title, session.directory, session.id, session.model?.id ?? '']
      if (!haystack.some((value) => value.toLowerCase().includes(needle))) {
        return false
      }
    }
    return true
  }

  async facets(): Promise<Facets> {
    const all = await this.client.listAllSessions()
    const directories = new Map<string, number>()
    const projects = new Map<string, number>()
    const models = new Map<string, number>()
    const agents = new Map<string, number>()
    let nonArchived = 0
    let archived = 0
    let roots = 0
    for (const session of all) {
      this.increment(directories, session.directory)
      this.increment(projects, session.project?.worktree ?? session.projectID)
      this.increment(models, session.model?.id ?? 'unknown')
      this.increment(agents, session.agent ?? 'unknown')
      if (session.time.archived != null) {
        archived += 1
      } else {
        nonArchived += 1
      }
      if (!session.parentID) roots += 1
    }
    return {
      directories: this.buckets(directories),
      projects: this.buckets(projects),
      models: this.buckets(models),
      agents: this.buckets(agents),
      totals: { all: all.length, nonArchived, archived, roots },
    }
  }

  async stats(): Promise<Stats> {
    const all = await this.client.listAllSessions()
    let archived = 0
    let cost = 0
    let tokensIn = 0
    let tokensOut = 0
    let tokensReasoning = 0
    let cacheRead = 0
    let cacheWrite = 0
    const models = new Map<string, StatBucket>()
    const projects = new Map<string, StatBucket>()
    const agents = new Map<string, StatBucket>()
    const months = new Map<string, MonthStat>()
    const sessions: TopSession[] = []
    for (const session of all) {
      const sessionCost = this.num(session.cost)
      const input = this.num(session.tokens.input)
      const output = this.num(session.tokens.output)
      cost += sessionCost
      tokensIn += input
      tokensOut += output
      tokensReasoning += this.num(session.tokens.reasoning)
      cacheRead += this.num(session.tokens.cache.read)
      cacheWrite += this.num(session.tokens.cache.write)
      if (session.time.archived != null) {
        archived += 1
      }
      this.accumulate(models, session.model?.id ?? 'unknown', sessionCost, input, output)
      this.accumulate(projects, session.project?.worktree ?? session.projectID, sessionCost, input, output)
      this.accumulate(agents, session.agent ?? 'unknown', sessionCost, input, output)
      const month = new Date(session.time.created).toISOString().slice(0, 7)
      const bucket = months.get(month) ?? { month, count: 0, cost: 0, tokensIn: 0, tokensOut: 0 }
      bucket.count += 1
      bucket.cost += sessionCost
      bucket.tokensIn += input
      bucket.tokensOut += output
      months.set(month, bucket)
      sessions.push({ id: session.id, title: session.title, cost: sessionCost, tokensIn: input, tokensOut: output })
    }
    return {
      totals: {
        sessions: all.length,
        archived,
        nonArchived: all.length - archived,
        cost,
        tokensIn,
        tokensOut,
        tokensReasoning,
        cacheRead,
        cacheWrite,
      },
      byModel: this.sortBuckets(models),
      byProject: this.sortBuckets(projects),
      byAgent: this.sortBuckets(agents),
      byMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
      topByTokens: [...sessions]
        .sort((a, b) => b.tokensIn + b.tokensOut - (a.tokensIn + a.tokensOut))
        .slice(0, 10),
      topByCost: [...sessions].sort((a, b) => b.cost - a.cost).slice(0, 10),
    }
  }

  async healthReport(options?: { staleDays?: number }): Promise<HealthReport> {
    const staleDays = options?.staleDays ?? 90
    const all = await this.client.listAllSessions()
    const ids = new Set(all.map((session) => session.id))
    const orphanChildren: OrphanChild[] = []
    const emptySessions: HealthItem[] = []
    const staleSessions: HealthItem[] = []
    let archived = 0
    const staleBefore = Date.now() - staleDays * 86400000
    for (const session of all) {
      if (session.time.archived != null) archived += 1
      if (session.parentID && !ids.has(session.parentID)) {
        orphanChildren.push({ id: session.id, title: session.title, parentID: session.parentID })
      }
      const input = this.num(session.tokens.input)
      const output = this.num(session.tokens.output)
      const cacheRead = this.num(session.tokens.cache?.read)
      if (session.title.startsWith('New session') || (session.cost === 0 && input + output + cacheRead === 0)) {
        emptySessions.push(this.healthItem(session))
      }
      if (session.time.archived == null && session.time.updated < staleBefore) {
        staleSessions.push(this.healthItem(session))
      }
    }
    const orphanDiffFiles = this.orphanDiffFiles(ids)
    const protectedMissing = this.store.list().filter((id) => !ids.has(id))
    return {
      totals: {
        sessions: all.length,
        archived,
        orphanChildren: orphanChildren.length,
        orphanDiffFiles: orphanDiffFiles.length,
        emptySessions: emptySessions.length,
        staleSessions: staleSessions.length,
        protectedMissing: protectedMissing.length,
      },
      orphanChildren,
      orphanDiffFiles,
      emptySessions: emptySessions.slice(0, 300),
      staleSessions: staleSessions.sort((a, b) => a.updated - b.updated).slice(0, 300),
      protectedMissing,
    }
  }

  private healthItem(session: Session): HealthItem {
    return {
      id: session.id,
      title: session.title,
      directory: session.directory,
      updated: session.time.updated,
      archived: session.time.archived != null,
    }
  }

  private orphanDiffFiles(ids: Set<string>): string[] {
    const dir = join(config.opencodeDataDir, 'storage', 'session_diff')
    if (!existsSync(dir)) return []
    const files: string[] = []
    for (const name of readdirSync(dir)) {
      if (!name.startsWith('ses_') || !name.endsWith('.json')) continue
      const id = name.slice(0, -'.json'.length)
      if (!ids.has(id)) files.push(name)
    }
    return files.sort()
  }

  get(id: string): Promise<Session> {
    return this.client.getSession(id)
  }

  messages(id: string, options: MessageQuery): Promise<Message[]> {
    return this.client.getMessages(id, options)
  }

  async children(id: string): Promise<Session[]> {
    const children = await this.client.getChildren(id)
    const all = await this.client.listAllSessions()
    const childCounts = new Map<string, number>()
    for (const session of all) {
      if (session.parentID) {
        childCounts.set(session.parentID, (childCounts.get(session.parentID) ?? 0) + 1)
      }
    }
    const sorted = [...children].sort((a, b) => b.time.updated - a.time.updated)
    for (const child of sorted) {
      child.childCount = childCounts.get(child.id) ?? 0
    }
    return sorted
  }

  async exportBundle(id: string): Promise<ExportBundle> {
    const info = await this.client.getSession(id)
    const messages = await this.client.getMessages(id)
    return { info, messages }
  }

  async backup(id: string): Promise<BackupInfo> {
    const bundle = await this.exportBundle(id)
    const dir = this.exportsDir()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const name = `${id}.json`
    const file = join(dir, name)
    writeFileSync(file, JSON.stringify(bundle, null, 2))
    const stat = statSync(file)
    return {
      name,
      size: stat.size,
      mtime: stat.mtimeMs,
      sessionId: id,
      title: bundle.info.title,
      directory: bundle.info.directory,
      sessionCreated: bundle.info.time.created,
      messageCount: bundle.messages.length,
    }
  }

  listBackups(): BackupInfo[] {
    const dir = this.exportsDir()
    if (!existsSync(dir)) return []
    const backups: BackupInfo[] = []
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue
      const file = join(dir, name)
      const stat = statSync(file)
      if (!stat.isFile()) continue
      const sessionId = name.slice(0, -'.json'.length)
      let title: string | undefined
      let directory: string | undefined
      let sessionCreated: number | undefined
      let messageCount: number | undefined
      try {
        const bundle = JSON.parse(readFileSync(file, 'utf8')) as ExportBundle
        title = bundle.info?.title
        directory = bundle.info?.directory
        sessionCreated = bundle.info?.time?.created
        messageCount = bundle.messages?.length
      } catch {
        title = undefined
      }
      backups.push({ name, size: stat.size, mtime: stat.mtimeMs, sessionId, title, directory, sessionCreated, messageCount })
    }
    return backups.sort((a, b) => b.mtime - a.mtime)
  }

  deleteBackup(name: string): Promise<void> {
    const file = this.backupPath(name)
    if (!existsSync(file)) {
      throw new Error('not found')
    }
    unlinkSync(file)
    return Promise.resolve()
  }

  async restoreBackup(name: string): Promise<RestoreResult> {
    const file = this.backupPath(name)
    if (!existsSync(file)) {
      throw new Error('not found')
    }
    const { code, stdout, stderr } = await this.runImport(file)
    if (code !== 0) {
      throw new Error(stderr.trim() || stdout.trim() || 'import failed')
    }
    const match = stdout.match(/Imported session:\s*(ses_\S+)/)
    const sessionId = match ? match[1] : name.slice(0, -'.json'.length)
    return { sessionId }
  }

  private runImport(file: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(config.opencodeBin, ['import', file], { shell: process.platform === 'win32' })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })
      child.on('error', rejectPromise)
      child.on('close', (code) => {
        resolvePromise({ code, stdout, stderr })
      })
    })
  }

  backupPath(name: string): string {
    if (name.includes('/') || name.includes('\\') || !name.endsWith('.json')) {
      throw new Error(`invalid backup name: ${name}`)
    }
    return join(this.exportsDir(), name)
  }

  private exportsDir(): string {
    return resolve(process.cwd(), 'data', 'exports')
  }

  todos(id: string): Promise<Todo[]> {
    return this.client.getTodos(id)
  }

  update(id: string, patch: SessionPatch): Promise<Session> {
    return this.client.updateSession(id, patch)
  }

  async impact(id: string): Promise<SessionImpact> {
    const session = await this.client.getSession(id)
    const messages = await this.client.getMessages(id)
    const children = await this.client.getChildren(id)
    let parts = 0
    for (const message of messages) parts += message.parts.length
    return {
      session: {
        id: session.id,
        title: session.title,
        directory: session.directory,
        archived: session.time.archived != null,
      },
      messages: messages.length,
      parts,
      children: children.length,
      protected: this.store.has(id),
    }
  }

  listProtected(): string[] {
    return this.store.list()
  }

  protect(id: string): void {
    this.store.add(id)
  }

  unprotect(id: string): void {
    this.store.remove(id)
  }

  async delete(id: string, force = false): Promise<void> {
    if (this.store.has(id) && !force) {
      throw new SessionProtectedError(id)
    }
    try {
      await this.client.deleteSession(id)
    } catch (error) {
      if (error instanceof OpencodeRequestError && error.status === 404) {
        throw new SessionGoneError(id)
      }
      throw error
    }
    this.store.remove(id)
  }

  async bulkDelete(ids: string[], options: BulkDeleteOptions = {}): Promise<BulkDeleteResult> {
    const results: BulkDeleteItemResult[] = []
    let deleted = 0
    let failed = 0
    let skippedProtected = 0
    let backedUp = 0
    let notFound = 0
    for (const id of ids.slice(0, 500)) {
      if (typeof id !== 'string' || !id) continue
      if (this.store.has(id) && !options.force) {
        results.push({ id, ok: false, protected: true })
        skippedProtected += 1
        continue
      }
      let info: BackupInfo | undefined
      try {
        if (options.backup) {
          info = await this.backup(id)
        }
        await this.delete(id, options.force)
        results.push({ id, ok: true, backupName: info?.name })
        deleted += 1
        if (info) backedUp += 1
      } catch (error) {
        if (error instanceof SessionGoneError) {
          results.push({ id, ok: false, error: 'not_found' })
          notFound += 1
          continue
        }
        results.push({ id, ok: false, error: (error as Error).message })
        failed += 1
      }
    }
    return { results, deleted, failed, skippedProtected, backedUp, notFound }
  }

  private matches(session: Session, q: SessionQuery): boolean {
    if (q.directory && !session.directory.toLowerCase().includes(q.directory.toLowerCase())) {
      return false
    }
    if (q.projectId && session.projectID !== q.projectId) {
      return false
    }
    if (q.roots && session.parentID) {
      return false
    }
    const archived = q.archived ?? 'false'
    if (archived === 'false' && session.time.archived != null) {
      return false
    }
    if (archived === 'true' && session.time.archived == null) {
      return false
    }
    if (q.search) {
      const needle = q.search.toLowerCase()
      const haystack = [session.title, session.directory, session.id, session.model?.id ?? '']
      if (!haystack.some((value) => value.toLowerCase().includes(needle))) {
        return false
      }
    }
    return true
  }

  private sort(sessions: Session[], q: SessionQuery): Session[] {
    const field = q.sort ?? 'updated'
    const direction = q.order ?? 'desc'
    const factor = direction === 'asc' ? 1 : -1
    return [...sessions].sort((a, b) => {
      const result = this.compare(a, b, field)
      return result * factor
    })
  }

  private compare(a: Session, b: Session, field: NonNullable<SessionQuery['sort']>): number {
    switch (field) {
      case 'created':
        return a.time.created - b.time.created
      case 'cost':
        return a.cost - b.cost
      case 'tokens':
        return a.tokens.input + a.tokens.output - (b.tokens.input + b.tokens.output)
      case 'title':
        return a.title.localeCompare(b.title)
      case 'directory':
        return a.directory.localeCompare(b.directory)
      case 'updated':
      default:
        return a.time.updated - b.time.updated
    }
  }

  private increment(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1)
  }

  private num(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }

  private accumulate(
    map: Map<string, StatBucket>,
    key: string,
    cost: number,
    tokensIn: number,
    tokensOut: number,
  ): void {
    const bucket = map.get(key) ?? { value: key, count: 0, cost: 0, tokensIn: 0, tokensOut: 0 }
    bucket.count += 1
    bucket.cost += cost
    bucket.tokensIn += tokensIn
    bucket.tokensOut += tokensOut
    map.set(key, bucket)
  }

  private sortBuckets(map: Map<string, StatBucket>): StatBucket[] {
    return [...map.values()].sort((a, b) => b.count - a.count || b.cost - a.cost)
  }

  private buckets(map: Map<string, number>): FacetBucket[] {
    return [...map.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
  }
}
