import { useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { useGameState } from '../state/GameState'
import { FAILURE_DIRECTIVES, TERM_LENGTH } from '../game/runRules'
import { SegmentedGauge } from './SegmentedGauge'
import type { Headline } from '../types'

type TerminalChromeProps = {
  ambientEnabled: boolean
  headlines: Headline[]
  showMeterGuide: boolean
  onAmbientToggle: () => void
  onDismissMeterGuide: () => void
  onHowToPlay: () => void
}

function utcTime(date: Date) {
  return `${date.toISOString().slice(11, 19)} UTC`
}

export function TerminalChrome({
  ambientEnabled,
  headlines,
  showMeterGuide,
  onAmbientToggle,
  onDismissMeterGuide,
  onHowToPlay,
}: TerminalChromeProps) {
  const [time, setTime] = useState(() => utcTime(new Date()))
  const { activeNation, activeWorldState } = useGameState()
  const tickerText =
    headlines.length > 0
      ? headlines
          .slice(0, 10)
          .map((headline) => `${headline.source.toUpperCase()} // ${headline.title}`)
          .join(' • ')
      : 'SECURE NEWS CHANNEL AWAITING SOURCE DATA'

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
        <div
          className="classification-banner"
          data-corrupt={`${activeNation.shortName}//SITROOM`}
        >
          {activeNation.shortName} // LIVE WORLD // YOUR MOVE
        </div>
        <div className="terminal-statuses">
          <span className="status-item status-item--secure">
            <i aria-hidden="true" /> LIVE FEED
          </span>
          <span className="status-item status-item--turn">
            {activeNation.shortName} // TURN{' '}
            {String(activeWorldState.turn).padStart(2, '0')}
          </span>
          <time
            className="status-item status-item--clock"
            dateTime={new Date().toISOString()}
          >
            {time}
          </time>
          <button
            type="button"
            className="how-to-play"
            onClick={onHowToPlay}
          >
            HOW TO PLAY
          </button>
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

      <m.section
        className="world-meter-bar"
        aria-label={`${activeNation.name} world state`}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.34 }}
      >
        <span className="meter-bar-label">
          {activeNation.shortName} NATIONAL PULSE
        </span>
        {activeNation.meters.map((meter) => (
          <SegmentedGauge
            compact
            description={meter.description}
            key={meter.key}
            label={meter.label.toUpperCase()}
            tone={meter.tone}
            value={activeWorldState.meters[meter.key]}
          />
        ))}
      </m.section>

      <m.section
        className="objective-bar"
        aria-label="Current term objective"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.3 }}
      >
        <span>YOUR GOAL</span>
        <strong>
          TURN {Math.min(activeWorldState.turn, TERM_LENGTH)} / {TERM_LENGTH}{' '}
          — SURVIVE SIX TURNS
        </strong>
        <small>{FAILURE_DIRECTIVES[activeNation.id]}</small>
      </m.section>

      {showMeterGuide && (
        <m.aside
          className="guided-tip guided-tip--meters"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
        >
          <span>GUIDE // WORLD STATE</span>
          These four meters are your survival conditions. Hover or focus each
          label for its meaning.
          <button type="button" onClick={onDismissMeterGuide}>
            UNDERSTOOD
          </button>
        </m.aside>
      )}

      <div className="headline-ticker" aria-label="Incoming intelligence headlines">
        <span className="ticker-label">LIVE NOW // </span>
        <div className="ticker-window">
          <div className="ticker-track">
            {tickerText} •&nbsp; {tickerText} •&nbsp;
          </div>
        </div>
      </div>
    </>
  )
}
