import { useEffect, useState } from 'react'
import { deleteBackup, getBackups, restoreBackup } from '../api'
import type { BackupInfo } from '../api'
import { btnSmall, btnSmallDanger, cardStyle, colors, metaStyle, tableStyle, tdStyle, thStyle } from '../ui'

function formatSize(size: number): string {
  return `${(size / 1024).toFixed(1)} KB`
}

function formatTime(ts?: number): string {
  if (ts == null) return '—'
  return new Date(ts).toLocaleString()
}

function backupTitle(b: BackupInfo): string {
  return b.title || b.sessionId || b.name
}

export function BackupsPanel({ onRestored }: { onRestored?: (sessionId: string) => void }) {
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [restoreResult, setRestoreResult] = useState<{ name: string; sessionId: string } | null>(null)
  const [restoreError, setRestoreError] = useState<{ name: string; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getBackups()
      .then((data) => {
        if (!cancelled) setBackups(data)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setBackups([])
          setError(e instanceof Error ? e.message : '加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function handleDelete(name: string) {
    if (!window.confirm('确定删除该备份？')) return
    setDeleting(name)
    setDeleteError(null)
    deleteBackup(name)
      .then(() => {
        setReloadKey((k) => k + 1)
      })
      .catch((e: unknown) => {
        setDeleteError(e instanceof Error ? e.message : '删除失败')
      })
      .finally(() => {
        setDeleting(null)
      })
  }

  function handleRestore(name: string) {
    setRestoring(name)
    setRestoreResult(null)
    setRestoreError(null)
    restoreBackup(name)
      .then((r) => {
        setRestoreResult({ name, sessionId: r.sessionId })
        if (onRestored) onRestored(r.sessionId)
        setReloadKey((k) => k + 1)
      })
      .catch((e: unknown) => {
        setRestoreError({ name, message: e instanceof Error ? e.message : '恢复失败' })
      })
      .finally(() => {
        setRestoring(null)
      })
  }

  const monoStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <strong style={{ fontSize: 15, color: colors.text }}>服务器备份（data/exports）</strong>
        <button style={btnSmall} onClick={() => setReloadKey((k) => k + 1)} disabled={loading}>
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {loading ? <p style={{ ...metaStyle, margin: 0 }}>加载中...</p> : null}

      {!loading && error ? (
        <p style={{ color: colors.danger, margin: 0, fontSize: 13 }}>加载失败：{error}</p>
      ) : null}

      {!loading && !error && backups.length === 0 ? (
        <p style={{ ...metaStyle, margin: 0 }}>暂无备份</p>
      ) : null}

      {!loading && !error && backups.length > 0 ? (
        <>
          <table style={{ ...tableStyle, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: '18%' }}>标题</th>
                <th style={{ ...thStyle, width: '12%' }}>会话ID</th>
                <th style={{ ...thStyle, width: '20%' }}>目录</th>
                <th style={{ ...thStyle, width: '7%' }}>消息数</th>
                <th style={{ ...thStyle, width: '12%' }}>会话创建时间</th>
                <th style={{ ...thStyle, width: '12%' }}>备份时间</th>
                <th style={{ ...thStyle, width: '8%' }}>大小</th>
                <th style={{ ...thStyle, width: '11%' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name} className="ui-row">
                  <td style={{ ...tdStyle, fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {backupTitle(b)}
                  </td>
                  <td style={{ ...tdStyle, ...monoStyle, fontSize: 11, color: colors.secondary, overflowWrap: 'anywhere' }}>
                    {b.sessionId || '—'}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: colors.secondary, overflowWrap: 'anywhere' }}>
                    {b.directory || '—'}
                  </td>
                  <td style={tdStyle}>{b.messageCount ?? '—'}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 12, color: colors.secondary }}>
                    {formatTime(b.sessionCreated)}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 12, color: colors.secondary }}>
                    {formatTime(b.mtime)}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatSize(b.size)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <a
                        style={{ ...btnSmall, textDecoration: 'none', display: 'inline-block' }}
                        href={`/api/backups/${encodeURIComponent(b.name)}`}
                        download={b.name}
                      >
                        下载
                      </a>
                      <button
                        style={btnSmall}
                        onClick={() => handleRestore(b.name)}
                        disabled={restoring === b.name}
                      >
                        {restoring === b.name ? '恢复中...' : '恢复'}
                      </button>
                      <button
                        style={btnSmallDanger}
                        onClick={() => handleDelete(b.name)}
                        disabled={deleting === b.name}
                      >
                        {deleting === b.name ? '删除中...' : '删除'}
                      </button>
                    </div>
                    {restoreResult?.name === b.name ? (
                      <p style={{ color: colors.success, margin: '6px 0 0', fontSize: 12, overflowWrap: 'anywhere' }}>
                        已恢复：{restoreResult.sessionId}
                      </p>
                    ) : null}
                    {restoreError?.name === b.name ? (
                      <p style={{ color: colors.danger, margin: '6px 0 0', fontSize: 12, overflowWrap: 'anywhere' }}>
                        恢复失败：{restoreError.message}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {deleteError ? (
            <p style={{ color: colors.danger, margin: '12px 0 0', fontSize: 13 }}>删除失败：{deleteError}</p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
