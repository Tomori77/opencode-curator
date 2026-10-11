import type { CSSProperties } from 'react'

export const colors = {
  bg: '#f5f5f7',
  card: '#ffffff',
  hairline: '#e5e5ea',
  text: '#1d1d1f',
  secondary: '#6e6e73',
  accent: '#0071e3',
  danger: '#ff3b30',
  success: '#34c759',
  warn: '#ff9f0a',
  selection: 'rgba(0,113,227,0.08)',
  hover: '#f5f5f7',
}

export const fontStack =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif'

export const radius = {
  card: 16,
  control: 10,
  pill: 999,
}

export const shadows = {
  card: '0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)',
  control: '0 1px 2px rgba(0,0,0,.05)',
  segment: '0 1px 2px rgba(0,0,0,.12)',
}

export const globalCss = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: ${colors.bg}; color: ${colors.text}; font-family: ${fontStack}; -webkit-font-smoothing: antialiased; }
button { font-family: inherit; }
button:disabled { opacity: .45; cursor: default; }
button:not(:disabled) { transition: filter .12s ease, background .12s ease, box-shadow .12s ease; }
button:not(:disabled):hover { filter: brightness(.96); }
.ui-seg:hover { filter: none !important; }
.ui-row { transition: background .12s ease; }
.ui-row:hover { background: ${colors.hover}; }
.ui-link { color: ${colors.accent}; cursor: pointer; text-decoration: none; }
.ui-link:hover { text-decoration: underline; }
a { color: ${colors.accent}; }
a:hover { text-decoration: underline; }
input:focus, select:focus, textarea:focus { outline: none !important; border-color: ${colors.accent} !important; box-shadow: 0 0 0 3px rgba(0,113,227,0.18) !important; }
`

export const appStyle: CSSProperties = {
  minHeight: '100vh',
  background: colors.bg,
  color: colors.text,
  fontFamily: fontStack,
}

export const containerStyle: CSSProperties = {
  maxWidth: 1440,
  margin: '0 auto',
  padding: '28px 24px 56px',
}

export const titleBarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 16,
  marginBottom: 24,
}

export const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: colors.text,
}

export const subtitleStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 12,
  fontSize: 13,
  color: colors.secondary,
  marginTop: 6,
}

export function dotStyle(color: string): CSSProperties {
  return {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
  }
}

export const segmentedStyle: CSSProperties = {
  display: 'inline-flex',
  padding: 3,
  gap: 2,
  background: 'rgba(118,118,128,0.12)',
  borderRadius: radius.pill,
}

export function segmentStyle(active: boolean): CSSProperties {
  return {
    border: 'none',
    fontFamily: fontStack,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.2,
    padding: '7px 16px',
    borderRadius: radius.pill,
    cursor: active ? 'default' : 'pointer',
    background: active ? colors.card : 'transparent',
    color: active ? colors.text : colors.secondary,
    boxShadow: active ? shadows.segment : 'none',
  }
}

export const cardStyle: CSSProperties = {
  background: colors.card,
  border: `1px solid ${colors.hairline}`,
  borderRadius: radius.card,
  boxShadow: shadows.card,
  padding: 20,
}

export const subCardStyle: CSSProperties = {
  background: colors.card,
  border: `1px solid ${colors.hairline}`,
  borderRadius: 12,
  boxShadow: shadows.control,
  padding: '12px 16px',
  minWidth: 130,
}

export const controlStyle: CSSProperties = {
  fontFamily: fontStack,
  fontSize: 13,
  color: colors.text,
  padding: '9px 12px',
  borderRadius: radius.control,
  border: `1px solid ${colors.hairline}`,
  background: colors.card,
  boxShadow: shadows.control,
  maxWidth: '100%',
}

export const checkboxStyle: CSSProperties = {
  width: 16,
  height: 16,
  accentColor: colors.accent,
  cursor: 'pointer',
  margin: 0,
}

export const labelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: colors.secondary,
}

export const buttonStyle: CSSProperties = {
  fontFamily: fontStack,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.2,
  padding: '9px 16px',
  borderRadius: radius.pill,
  border: `1px solid ${colors.hairline}`,
  background: colors.card,
  color: colors.text,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export const btnPrimary: CSSProperties = {
  ...buttonStyle,
  background: colors.accent,
  borderColor: colors.accent,
  color: '#ffffff',
}

export const btnDanger: CSSProperties = {
  ...buttonStyle,
  color: colors.danger,
  borderColor: 'rgba(255,59,48,0.35)',
  background: colors.card,
}

export const btnDangerFilled: CSSProperties = {
  ...buttonStyle,
  background: colors.danger,
  borderColor: colors.danger,
  color: '#ffffff',
}

export const btnGhost: CSSProperties = {
  ...buttonStyle,
  borderColor: 'transparent',
  background: 'transparent',
  color: colors.accent,
}

export const btnSmall: CSSProperties = {
  ...buttonStyle,
  fontSize: 12,
  padding: '5px 13px',
}

export const btnSmallDanger: CSSProperties = {
  ...btnSmall,
  color: colors.danger,
  borderColor: 'rgba(255,59,48,0.35)',
}

function pill(background: string, color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 9px',
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1.6,
    borderRadius: radius.pill,
    background,
    color,
    whiteSpace: 'nowrap',
  }
}

export const pillNeutral = pill('#f0f0f2', colors.secondary)
export const pillAccent = pill('rgba(0,113,227,0.10)', colors.accent)
export const pillSuccess = pill('rgba(52,199,89,0.14)', '#1a8a37')
export const pillDanger = pill('rgba(255,59,48,0.12)', colors.danger)
export const pillWarn = pill('rgba(255,159,10,0.16)', '#b26a00')

export function statusPill(status: string): CSSProperties {
  if (status === 'completed' || status === 'success') return pillSuccess
  if (status === 'error' || status === 'failed') return pillDanger
  return pillAccent
}

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
}

export const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: colors.secondary,
  borderBottom: `1px solid ${colors.hairline}`,
  whiteSpace: 'nowrap',
}

export const tdStyle: CSSProperties = {
  padding: '12px',
  borderBottom: `1px solid ${colors.hairline}`,
  verticalAlign: 'top',
  color: colors.text,
}

export const rowClass = 'ui-row'
export const linkClass = 'ui-link'

export function rowStyle(selected: boolean, open: boolean): CSSProperties {
  return {
    cursor: 'pointer',
    background: selected ? colors.selection : undefined,
    boxShadow: open ? `inset 3px 0 0 ${colors.accent}` : undefined,
  }
}

export const sessionListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

export const sessionHeaderStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 10,
  padding: '8px 14px',
  fontSize: 12,
  color: colors.secondary,
}

export const rowCardStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: 12,
  padding: '12px 14px',
  border: `1px solid ${colors.hairline}`,
  borderRadius: 12,
  background: colors.card,
}

export const rowMainStyle: CSSProperties = {
  flex: '1 1 260px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

export const rowTitleLineStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
}

export const rowTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  overflowWrap: 'anywhere',
  minWidth: 0,
}

export const rowMetaStyle: CSSProperties = {
  fontSize: 12,
  color: colors.secondary,
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}

export const rowTrailingStyle: CSSProperties = {
  flex: '0 1 auto',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '6px 12px',
  marginLeft: 'auto',
  fontSize: 12,
  color: colors.secondary,
}

export const selectionBarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  marginBottom: 12,
  background: colors.selection,
  border: '1px solid rgba(0,113,227,0.18)',
  borderRadius: 12,
  fontSize: 13,
  color: colors.text,
}

export const detailAsideStyle: CSSProperties = {
  flex: '0 0 420px',
  width: 420,
  maxWidth: '100%',
  position: 'sticky',
  top: 24,
  maxHeight: 'calc(100vh - 48px)',
  overflowY: 'auto',
}

export const sectionTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: colors.text,
}

export const metaStyle: CSSProperties = {
  fontSize: 12,
  color: colors.secondary,
  lineHeight: 1.8,
}

export const codeStyle: CSSProperties = {
  background: colors.bg,
  borderRadius: 8,
  padding: 10,
  margin: '6px 0',
  fontSize: 12,
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
}

export const userBubbleStyle: CSSProperties = {
  background: colors.selection,
  borderRadius: 14,
  padding: '10px 14px',
  margin: '12px 0',
}

export const assistantBlockStyle: CSSProperties = {
  background: colors.card,
  border: `1px solid ${colors.hairline}`,
  borderRadius: 14,
  padding: '12px 14px',
  margin: '12px 0',
}

export const toolCardStyle: CSSProperties = {
  background: colors.bg,
  border: `1px solid ${colors.hairline}`,
  borderRadius: 10,
  padding: 10,
  margin: '6px 0',
  fontSize: 12,
}

export const messageLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: colors.secondary,
}

export const dialogOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 16,
}

export const dialogStyle: CSSProperties = {
  background: colors.card,
  borderRadius: radius.card,
  border: `1px solid ${colors.hairline}`,
  padding: 24,
  width: 480,
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100vh - 64px)',
  overflowY: 'auto',
  boxShadow: shadows.card,
  fontFamily: fontStack,
  color: colors.text,
}

export const dialogTitleStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 20,
  fontWeight: 600,
  color: colors.text,
}

export const dialogActionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 20,
}
