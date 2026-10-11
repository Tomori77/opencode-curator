import { useState } from 'react'
import { bulkDelete } from '../api'
import type { BulkDeleteResult } from '../api'
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

interface BulkDeleteDialogProps {
  ids: string[]
  titles?: string[]
  onClose: () => void
  onDone: (result: BulkDeleteResult) => void
}

export function BulkDeleteDialog({ ids, titles, onClose, onDone }: BulkDeleteDialogProps) {
  const [confirmed, setConfirmed] = useState(false)
  const [backup, setBackup] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BulkDeleteResult | null>(null)

  function confirm() {
    if (!confirmed || deleting) return
    setDeleting(true)
    setError(null)
    bulkDelete(ids, { backup })
      .then((r) => {
        const issues = r.skippedProtected > 0 || r.failed > 0 || r.notFound > 0
        if (issues) {
          setResult(r)
        } else {
          onDone(r)
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : '删除失败')
      })
      .finally(() => {
        setDeleting(false)
      })
  }

  const issues = result ? result.results.filter((it) => !it.ok) : []
  const preview = titles ?? []
  const previewShown = preview.slice(0, 10)

  return (
    <div style={dialogOverlayStyle} onClick={deleting ? undefined : onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={dialogTitleStyle}>批量删除会话</h2>

        {result ? (
          <>
            <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.9 }}>
              <div>已删除：{result.deleted}</div>
              <div>失败：{result.failed}</div>
              <div>跳过（受保护）：{result.skippedProtected}</div>
              <div>已不存在（跳过）：{result.notFound}</div>
              <div>已备份：{result.backedUp}</div>
            </div>

            {issues.length > 0 ? (
              <div>
                <p style={{ color: colors.danger, fontSize: 13, margin: '12px 0 0' }}>
                  以下会话未能删除：
                </p>
                <ul
                  style={{
                    margin: '8px 0',
                    paddingLeft: 20,
                    fontSize: 13,
                    color: colors.secondary,
                    lineHeight: 1.7,
                  }}
                >
                  {issues.map((it) => (
                    <li key={it.id}>
                      {it.id}
                      {it.error === 'not_found'
                        ? '：已不存在（跳过）'
                        : it.protected
                          ? '（受保护）'
                          : it.error
                            ? `：${it.error}`
                            : '：原因未知'}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div style={dialogActionsStyle}>
              <button style={btnSmall} onClick={() => onDone(result)}>
                关闭
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.9 }}>
              <div>将删除 {ids.length} 个会话</div>
              <div>ID 列表：</div>
            </div>
            <ul
              style={{
                margin: '8px 0',
                paddingLeft: 20,
                fontSize: 13,
                color: colors.secondary,
                lineHeight: 1.7,
              }}
            >
              {(previewShown.length > 0 ? previewShown : ids.slice(0, 10)).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            {ids.length > 10 ? (
              <p style={{ fontSize: 12, color: colors.secondary, margin: '0 0 8px' }}>
                等共 {ids.length} 个
              </p>
            ) : null}

            <p style={{ color: colors.danger, fontSize: 13, margin: '12px 0' }}>
              警告：硬删除不可恢复，删除后无法找回这些会话及其消息与片段。
            </p>

            <label style={{ ...labelStyle, color: colors.text }}>
              <input
                type="checkbox"
                style={checkboxStyle}
                checked={backup}
                onChange={(e) => setBackup(e.target.checked)}
              />
              服务器备份
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

            {error ? (
              <p style={{ color: colors.danger, fontSize: 12, margin: '8px 0 0' }}>{error}</p>
            ) : null}

            <div style={dialogActionsStyle}>
              <button style={btnSmall} onClick={onClose} disabled={deleting}>
                取消
              </button>
              <button
                style={!confirmed || deleting ? btnSmall : btnDangerFilled}
                onClick={confirm}
                disabled={!confirmed || deleting}
              >
                {deleting ? '删除中...' : '删除'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
