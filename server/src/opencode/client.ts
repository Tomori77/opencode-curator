import type {
  ListSessionsOptions,
  Message,
  MessageQuery,
  Session,
  SessionPatch,
  Todo,
} from './types'

export interface OpencodeHealth {
  url: string
  reachable: boolean
  error?: string
}

export interface OpencodeClient {
  listSessions(options?: ListSessionsOptions): Promise<Session[]>
  listAllSessions(): Promise<Session[]>
  getSession(id: string): Promise<Session>
  getChildren(id: string): Promise<Session[]>
  getMessages(id: string, options?: MessageQuery): Promise<Message[]>
  getTodos(id: string): Promise<Todo[]>
  updateSession(id: string, patch: SessionPatch): Promise<Session>
  deleteSession(id: string): Promise<void>
  getHealth(): Promise<OpencodeHealth>
}
