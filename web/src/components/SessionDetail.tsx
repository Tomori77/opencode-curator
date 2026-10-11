import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  archiveSession,
  exportSessionUrl,
  getMessages,
  getSession,
  getTodos,
  updateSession,
} from '../api'
import type { Message, MessagePart, Session, Todo } from '../api'
import {
  assistantBlockStyle,
  btnSmall,
  btnSmallDanger,
  cardStyle,
  codeStyle,
  colors,
  controlStyle,
  linkClass,
  messageLabelStyle,
  metaStyle,
  pillNeutral,
  sectionTitleStyle,
  statusPill,
  toolCardStyle,
  userBubbleStyle,
} from '../ui'

interface SessionDetailProps {
  sessionId: string
  onClose: () => void
  onUpdated?: () => void
  onDelete?: () => void
  onToggleProtect?: () => void
  protected?: boolean
}

function formatCost(cost: number | undefined): string {
  if (typeof cost !== 'number' || !cost) return '0'
  return cost.toFixed(4)
}

function pretty(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function Collapsible(props: {
  label: string
  children: ReactNode
  defaultOpen?: boolean
  dim?: boolean
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? false)
  return (
    <div style={{ margin: '6px 0' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          cursor: 'pointer',
          fontSize: 12,
          background: 'none',
          border: 'none',
          padding: 0,
          color: props.dim ? colors.secondary : colors.accent,
        }}
      >
        {open ? '▾' : '▸'} {props.label}
      </button>
      {open ? (
        <div
          style={
            props.dim
              ? { color: colors.secondary, fontSize: 12, whiteSpace: 'pre-wrap', paddingLeft: 12 }
              : { paddingLeft: 12 }
          }
        >
          {props.children}
        </div>
      ) : null}
    </div>
  )
}

function assistantTokens(tokens: Message['info']['tokens']): string {
  if (!tokens) return ''
  return `输入 ${tokens.input ?? 0} / 输出 ${tokens.output ?? 0}`
}

function renderPart(part: MessagePart) {
  if (part.type === 'step-start') return null
  if (part.type === 'step-finish') {
    return (
      <hr
        key={part.id}
        style={{ border: 'none', borderTop: `1px solid ${colors.hairline}`, margin: '10px 0' }}
      />
    )
  }
  if (part.type === 'text') {
    return (
      <p key={part.id} style={{ whiteSpace: 'pre-wrap', margin: '4px 0', color: colors.text }}>
        {part.text}
      </p>
    )
  }
  if (part.type === 'reasoning') {
    return (
      <Collapsible key={part.id} label="思考" dim>
        {part.text}
      </Collapsible>
    )
  }
  if (part.type !== 'tool') return null
  return (
    <div key={part.id} style={toolCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ color: colors.text }}>{part.tool}</strong>
        <span style={statusPill(part.state.status)}>{part.state.status}</span>
        {part.state.title ? (
          <span style={{ color: colors.secondary }}>{part.state.title}</span>
        ) : null}
      </div>
      <Collapsible label="输入">
        <pre style={codeStyle}>{pretty(part.state.input)}</pre>
      </Collapsible>
      <Collapsible label="输出">
        <pre style={codeStyle}>{part.state.output ?? ''}</pre>
      </Collapsible>
    </div>
  )
}

function MessageBlock({ message }: { message: Message }) {
  const textParts = message.parts.filter((p) => p.type === 'text')
  if (message.info.role === 'user') {
    const prompt = textParts.map((p) => (p.type === 'text' ? p.text : '')).join('\n')
    return (
      <div style={userBubbleStyle}>
        <div style={messageLabelStyle}>用户</div>
        <p style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0', color: colors.text }}>{prompt}</p>
      </div>
    )
  }
  return (
    <div style={assistantBlockStyle}>
      <div style={messageLabelStyle}>
        助手
        {message.info.model ? ` · ${message.info.model.modelID}` : ''}
        {message.info.agent ? ` · ${message.info.agent}` : ''}
      </div>
      {message.parts.map(renderPart)}
      <div style={{ ...metaStyle, marginTop: 6 }}>
        费用 {formatCost(message.info.cost)}
        {message.info.tokens ? ` · ${assistantTokens(message.info.tokens)}` : ''}
      </div>
    </div>
  )
}

export function SessionDetail({
  sessionId,
  onClose,
  onUpdated,
  onDelete,
  onToggleProtect,
  protected: isProtected,
}: SessionDetailProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    let cancelled = false
    setSessionLoading(true)
    setSessionError(null)
    setMessagesLoading(true)
    setMessagesError(null)
    setMessages([])
    setTodos([])

    getSession(sessionId)
      .then((s) => {
        if (!cancelled) setSession(s)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSession(null)
          setSessionError(e instanceof Error ? e.message : '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false)
      })

    getMessages(sessionId)
      .then((r) => {
        if (!cancelled) {
          setMessages(r.data)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setMessagesError(e instanceof Error ? e.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false)
      })

    getTodos(sessionId)
      .then((r) => {
        if (!cancelled) setTodos(r.data)
      })
      .catch(() => {
        if (!cancelled) setTodos([])
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, reloadKey])

  function startEdit() {
    if (!session) return
    setTitleDraft(session.title)
    setSaveError(null)
    setEditing(true)
  }

  function cancelEdit() {
    if (saving) return
    setEditing(false)
    setSaveError(null)
  }

  function saveTitle() {
    if (!session) return
    const title = titleDraft.trim()
    if (!title || title === session.title) {
      setEditing(false)
      setSaveError(null)
      return
    }
    setSaving(true)
    setSaveError(null)
    updateSession(sessionId, { title })
      .then((updated) => {
        setSession(updated)
        setEditing(false)
        onUpdated?.()
      })
      .catch((e: unknown) => {
        setSaveError(e instanceof Error ? e.message : '保存失败')
      })
      .finally(() => {
        setSaving(false)
      })
  }

  function archive() {
    if (!session) return
    setArchiving(true)
    setArchiveError(null)
    archiveSession(sessionId)
      .then((updated) => {
        setSession(updated)
        onUpdated?.()
      })
      .catch((e: unknown) => {
        setArchiveError(e instanceof Error ? e.message : '归档失败')
      })
      .finally(() => {
        setArchiving(false)
      })
  }

  function exportJson() {
    const a = document.createElement('a')
    a.href = exportSessionUrl(sessionId)
    a.download = `${sessionId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div style={cardStyle}>
      {sessionLoading ? (
        <p style={{ ...metaStyle, margin: 0 }}>加载中...</p>
      ) : null}

      {!sessionLoading && sessionError ? (
        <div>
          <p style={{ color: colors.danger, margin: 0, fontSize: 13 }}>
            加载失败：{sessionError}
          </p>
          <button style={{ ...btnSmall, marginTop: 12 }} onClick={() => setReloadKey((k) => k + 1)}>
            重试
          </button>
        </div>
      ) : null}

      {!sessionLoading && !sessionError && session ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: 220 }}>
              {editing ? (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      style={{ ...controlStyle, flex: 1, minWidth: 0, fontSize: 16 }}
                    />
                    <button style={btnSmall} onClick={saveTitle} disabled={saving}>
                      {saving ? '保存中...' : '保存'}
                    </button>
                    <button style={btnSmall} onClick={cancelEdit} disabled={saving}>
                      取消
                    </button>
                  </div>
                  {saveError ? (
                    <p style={{ color: colors.danger, fontSize: 12, margin: '6px 0 0' }}>
                      保存失败：{saveError}
                    </p>
                  ) : null}
                </>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: 18, color: colors.text }}>{session.title}</h2>
                  <button style={btnSmall} onClick={startEdit}>
                    编辑
                  </button>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {!session.time.archived ? (
                <button style={btnSmall} onClick={archive} disabled={archiving}>
                  {archiving ? '归档中...' : '归档'}
                </button>
              ) : null}
              {onToggleProtect ? (
                <button style={btnSmall} onClick={onToggleProtect}>
                  {isProtected ? '取消保护' : '保护'}
                </button>
              ) : null}
              <button style={btnSmall} onClick={exportJson}>
                导出
              </button>
              {onDelete ? (
                <button style={btnSmallDanger} onClick={onDelete}>
                  删除
                </button>
              ) : null}
              <button style={btnSmall} onClick={onClose}>
                关闭
              </button>
            </div>
          </div>
          {archiveError ? (
            <p style={{ color: colors.danger, fontSize: 12, margin: '6px 0 0' }}>
              归档失败：{archiveError}
            </p>
          ) : null}
          <div style={{ ...metaStyle, marginTop: 12 }}>
            <div>ID：{session.id}</div>
            <div>目录：{session.directory}</div>
            <div>Worktree：{session.project?.worktree ?? '—'}</div>
            <div>模型：{session.model?.id ?? '—'}</div>
            <div>Agent：{session.agent ?? '—'}</div>
            <div>创建：{new Date(session.time.created).toLocaleString()}</div>
            <div>更新：{new Date(session.time.updated).toLocaleString()}</div>
            <div>费用：{formatCost(session.cost)}</div>
            <div>
              Tokens：输入 {session.tokens?.input ?? 0} / 输出 {session.tokens?.output ?? 0}
            </div>
            <div>版本：{session.version}</div>
            {session.time.archived ? (
              <div style={{ marginTop: 6 }}>
                <span style={pillNeutral}>已归档</span>
              </div>
            ) : null}
          </div>

          {todos.length > 0 ? (
            <div style={{ marginTop: 14 }}>
              <div style={sectionTitleStyle}>待办</div>
              <ul style={{ margin: '6px 0', paddingLeft: 20, fontSize: 12, color: colors.text }}>
                {todos.map((t, i) => (
                  <li key={`${t.position}-${i}`}>
                    [{t.status}] {t.content}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <hr
            style={{ border: 'none', borderTop: `1px solid ${colors.hairline}`, margin: '16px 0' }}
          />

          {messagesLoading ? (
            <p style={{ ...metaStyle, margin: 0 }}>消息加载中...</p>
          ) : null}

          {!messagesLoading && !messagesError && messages.length > 0 ? (
            <div style={{ fontSize: 12, color: colors.secondary }}>
              共 {messages.length} 条消息
            </div>
          ) : null}

          {messagesError ? (
            <div>
              <p style={{ color: colors.danger, margin: 0, fontSize: 13 }}>
                加载失败：{messagesError}
              </p>
              <button
                style={{ ...btnSmall, marginTop: 12 }}
                onClick={() => setReloadKey((k) => k + 1)}
              >
                重试
              </button>
            </div>
          ) : null}

          {!messagesLoading && !messagesError && messages.length === 0 ? (
            <p style={{ ...metaStyle, margin: 0 }}>无消息</p>
          ) : null}

          {messages.map((m) => (
            <MessageBlock key={m.info.id} message={m} />
          ))}
        </>
      ) : null}
    </div>
  )
}
