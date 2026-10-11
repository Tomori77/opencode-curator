import type {
  ListSessionsOptions,
  Message,
  MessageQuery,
  Session,
  SessionPatch,
  Todo,
} from './types'
import type { OpencodeClient, OpencodeHealth } from './client'

export class OpencodeRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message: string,
  ) {
    super(message)
    this.name = 'OpencodeRequestError'
  }
}

export class HttpOpencodeClient implements OpencodeClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, init)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new OpencodeRequestError(
        res.status,
        path,
        `opencode ${res.status} ${path}${text ? `: ${text}` : ''}`,
      )
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  listSessions(options: ListSessionsOptions = {}): Promise<Session[]> {
    const q = new URLSearchParams()
    if (options.directory) q.set('directory', options.directory)
    if (options.workspace) q.set('workspace', options.workspace)
    if (options.scope) q.set('scope', options.scope)
    if (options.path) q.set('path', options.path)
    if (options.search) q.set('search', options.search)
    if (options.limit != null) q.set('limit', String(options.limit))
    if (options.start != null) q.set('start', String(options.start))
    if (options.roots != null) q.set('roots', String(options.roots))
    const qs = q.toString()
    return this.request<Session[]>(`/session${qs ? `?${qs}` : ''}`)
  }

  listAllSessions(): Promise<Session[]> {
    return this.request<Session[]>('/experimental/session?limit=1000&archived=true')
  }

  getSession(id: string): Promise<Session> {
    return this.request<Session>(`/session/${encodeURIComponent(id)}`)
  }

  getChildren(id: string): Promise<Session[]> {
    return this.request<Session[]>(`/session/${encodeURIComponent(id)}/children`)
  }

  getMessages(id: string, options: MessageQuery = {}): Promise<Message[]> {
    const q = new URLSearchParams()
    if (options.limit != null) q.set('limit', String(options.limit))
    if (options.before) q.set('before', options.before)
    const qs = q.toString()
    return this.request<Message[]>(
      `/session/${encodeURIComponent(id)}/message${qs ? `?${qs}` : ''}`,
    )
  }

  getTodos(id: string): Promise<Todo[]> {
    return this.request<Todo[]>(`/session/${encodeURIComponent(id)}/todo`)
  }

  updateSession(id: string, patch: SessionPatch): Promise<Session> {
    return this.request<Session>(`/session/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }

  async deleteSession(id: string): Promise<void> {
    await this.request<unknown>(`/session/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  async getHealth(): Promise<OpencodeHealth> {
    try {
      await this.request<Session[]>('/session?limit=1')
      return { url: this.baseUrl, reachable: true }
    } catch (error) {
      return { url: this.baseUrl, reachable: false, error: (error as Error).message }
    }
  }
}
