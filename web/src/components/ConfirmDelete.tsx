import { useEffect, useState } from 'react'
import { ProtectedError, backupSession, deleteSession, getImpact } from '../api'
import type { BackupInfo, SessionImpact } from '../api'
import {
  btnDangerFilled,
  btnSmall,
  checkboxStyle,
  colors,
  dialogActionsStyle,
  dialogOverlayStyle,
  dialogStyle,
  dialogTitleStyle,
  labelStyle,
} from '../ui'

interface ConfirmDeleteProps {
  sessionId: string
  onClose: () => void
  onDeleted: () => void
}

export function ConfirmDelete({ sessionId, onClose, onDeleted }: ConfirmDeleteProps) {
  const [impact, setImpact] = useState<SessionImpact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [backupFirst, setBackupFirst] = useState(true)
  const [backupName, setBackupName] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setImpact(null)
    setConfirmed(false)
    setBackupFirst(true)
    setBackupName(null)
    setDeleteError(null)
    getImpact(sessionId)
      .then((r) => {
        if (!cancelled) setImpact(r)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  function confirm() {
    if (!impact || impact.protected || !confirmed || deleting) return
    setDeleting(true)
    setDeleteError(null)

    let backedUp = false
    const backup: Promise<BackupInfo | null> = backupFirst
      ? backupSession(sessionId).then((info) => {
          backedUp = true
          return info
        })
      : Promise.resolve(null)

    backup
      .then((info) => {
        if (info) setBackupName(info.name)
        return deleteSession(sessionId, false)
      })
      .then(() => onDeleted())
      .catch((e: unknown) => {
        if ((e as { notFound?: boolean } | null)?.notFound === true) {
          window.alert('会话不存在（可能已被删除，或属于桌面版 V2 存储）')
          onDeleted()
          return
        }
        if (e instanceof ProtectedError) {
          setDeleteError('该会话受保护，无法删除，请先取消保护')
        } else if (backupFirst && !backedUp) {
          setDeleteError(`备份失败，已中止删除：${e instanceof Error ? e.message : '未知错误'}`)
        } else {
          setDeleteError(e instanceof Error ? e.message : '删除失败')
        }
      })
      .finally(() => {
        setDeleting(false)
      })
  }

  const cannotDelete = !impact || impact.protected || !confirmed || deleting

  return (
    <div style={dialogOverlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={dialogTitleStyle}>删除会话</h2>

        {loading ? <p style={{ color: colors.secondary, margin: 0, fontSize: 13 }}>加载中...</p> : null}

        {!loading && error ? (
          <div>
            <p style={{ color: colors.danger, margin: 0, fontSize: 13 }}>加载失败：{error}</p>
            <button style={{ ...btnSmall, marginTop: 12 }} onClick={onClose}>
              关闭
            </button>
          </div>
        ) : null}

        {!loading && !error && impact ? (
          <>
            <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.9 }}>
              <div>
                <strong>{impact.session.title}</strong>
              </div>
              <div>ID：{impact.session.id}</div>
              <div>目录：{impact.session.directory}</div>
              <div>消息数：{impact.messages}</div>
              <div>片段数：{impact.parts}</div>
              <div>子会话数：{impact.children}</div>
              <div>是否已归档：{impact.session.archived ? '已归档' : '未归档'}</div>
              {impact.protected ? (
                <div style={{ color: colors.danger, marginTop: 4 }}>🔒 该会话受保护</div>
              ) : null}
            </div>

            <p style={{ color: colors.danger, fontSize: 13, margin: '12px 0' }}>
              警告：硬删除不可恢复，删除后无法找回该会话及其消息与片段。
            </p>

            {impact.protected ? (
              <p style={{ color: colors.danger, fontSize: 13, margin: '0 0 12px' }}>
                该会话受保护，请先取消保护后再删除。
              </p>
            ) : (
              <>
                <label style={{ ...labelStyle, color: colors.text }}>
                  <input
                    type="checkbox"
                    style={checkboxStyle}
                    checked={backupFirst}
                    onChange={(e) => setBackupFirst(e.target.checked)}
                  />
                  删除前在服务器备份到 data/exports
                </label>
                <label style={{ ...labelStyle, color: colors.text, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    style={checkboxStyle}
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  我确认删除且不可恢复
                </label>
              </>
            )}

            {backupName ? (
              <p style={{ color: '#1a8a37', fontSize: 12, margin: '8px 0 0' }}>已备份：{backupName}</p>
            ) : null}

            {deleteError ? (
              <p style={{ color: colors.danger, fontSize: 12, margin: '8px 0 0' }}>{deleteError}</p>
            ) : null}

            <div style={dialogActionsStyle}>
              <button style={btnSmall} onClick={onClose} disabled={deleting}>
                取消
              </button>
              <button
                style={cannotDelete ? btnSmall : btnDangerFilled}
                onClick={confirm}
                disabled={cannotDelete}
              >
                {deleting ? '删除中...' : '删除'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
