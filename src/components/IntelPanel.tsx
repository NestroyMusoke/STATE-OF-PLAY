import type { ReactNode } from 'react'
import { m } from 'framer-motion'

type IntelPanelProps = {
  children: ReactNode
  eyebrow: string
  mode: 'briefing' | 'decision' | 'debrief'
  onClose?: () => void
  side?: 'left' | 'right'
  title: string
}

export function IntelPanel({
  children,
  eyebrow,
  mode,
  onClose,
  side = 'right',
  title,
}: IntelPanelProps) {
  const timestamp = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  }).format(new Date())

  return (
    <m.aside
      className={`intel-panel hud-frame intel-panel--${side}`}
      initial={{ opacity: 0, x: side === 'right' ? 48 : -48 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: side === 'right' ? 48 : -48 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      aria-label={`${mode} panel`}
    >
      <div className="panel-function-row">
        <span>SEC-CH // 07</span>
        <span>{mode.toUpperCase()}</span>
      </div>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {onClose && (
          <button type="button" className="icon-button" onClick={onClose}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Close panel</span>
          </button>
        )}
      </div>
      <div className="coordinate-strip">
        <span>LAT 10.480°N</span>
        <span>LNG 66.900°W</span>
        <span>SITREP {timestamp}Z</span>
      </div>
      <div className="panel-body">{children}</div>
    </m.aside>
  )
}
