import { useEffect, useState } from 'react'
import { m } from 'framer-motion'

type TerminalChromeProps = {
  ambientEnabled: boolean
  onAmbientToggle: () => void
}

function utcTime(date: Date) {
  return `${date.toISOString().slice(11, 19)} UTC`
}

export function TerminalChrome({ ambientEnabled, onAmbientToggle }: TerminalChromeProps) {
  const [time, setTime] = useState(() => utcTime(new Date()))

  useEffect(() => {
    const interval = window.setInterval(() => setTime(utcTime(new Date())), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <>
      <m.header
        className="terminal-bar"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="classification-banner" data-corrupt="TS//SITROOM">
          TOP SECRET // SITROOM
        </div>
        <div className="terminal-statuses">
          <span className="status-item status-item--secure">
            <i aria-hidden="true" /> SECURE CHANNEL
          </span>
          <span className="status-item">DAY 01 // TURN 01</span>
          <time className="status-item" dateTime={new Date().toISOString()}>
            {time}
          </time>
          <button
            type="button"
            className="audio-toggle"
            aria-pressed={ambientEnabled}
            onClick={onAmbientToggle}
          >
            COMMS {ambientEnabled ? 'LIVE' : 'MUTED'}
          </button>
        </div>
      </m.header>

      <div className="headline-ticker" aria-label="Incoming intelligence headlines">
        <span className="ticker-label">INCOMING // </span>
        <div className="ticker-window">
          <div className="ticker-track">
            CARACAS SECURITY POSTURE CHANGES WITHOUT NOTICE • REGIONAL EMBASSIES REQUEST STATUS CHECK • SIGNAL INTERCEPT AWAITING CLASSIFICATION •&nbsp;
            CARACAS SECURITY POSTURE CHANGES WITHOUT NOTICE • REGIONAL EMBASSIES REQUEST STATUS CHECK • SIGNAL INTERCEPT AWAITING CLASSIFICATION •&nbsp;
          </div>
        </div>
      </div>
    </>
  )
}
