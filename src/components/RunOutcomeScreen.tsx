import { useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import type { NationDefinition } from '../types'
import type { LegacyResult } from '../game/legacyScore'
import type { RunOutcome } from '../game/runRules'

type RunOutcomeScreenProps = {
  nation: NationDefinition
  outcome: RunOutcome
  legacy: LegacyResult
  onRestart: () => void
}

function bestScoreKey(nationId: string) {
  return `state-of-play.legacy-best.v1.${nationId}`
}

function loadBestScore(nationId: string) {
  try {
    const stored = window.localStorage.getItem(bestScoreKey(nationId))
    if (stored === null) return null
    const score = Number.parseInt(stored, 10)
    return Number.isFinite(score) ? score : null
  } catch {
    return null
  }
}

export function RunOutcomeScreen({
  nation,
  outcome,
  legacy,
  onRestart,
}: RunOutcomeScreenProps) {
  const isWin = outcome.status === 'won'
  const previousBest = useRef<number | null>(loadBestScore(nation.id))
  const [bestScore, setBestScore] = useState(
    Math.max(previousBest.current ?? 0, legacy.score),
  )
  const [isNewBest, setIsNewBest] = useState(false)
  const [shareStatus, setShareStatus] = useState('SHARE RESULT')

  useEffect(() => {
    const prior = previousBest.current
    if (prior !== null && legacy.score <= prior) {
      setBestScore(prior)
      return
    }

    try {
      window.localStorage.setItem(
        bestScoreKey(nation.id),
        String(legacy.score),
      )
    } catch {
      // The result remains usable when storage is unavailable.
    }
    previousBest.current = legacy.score
    setBestScore(legacy.score)
    setIsNewBest(true)
  }, [legacy.score, nation.id])

  async function shareResult() {
    const text = [
      `STATE OF PLAY // ${nation.name}`,
      `Legacy Score: ${legacy.score}/100`,
      legacy.verdict,
      `Real fact: ${legacy.realFact}`,
    ].join('\n')

    try {
      if (navigator.share) {
        await navigator.share({ title: 'STATE OF PLAY result', text })
        setShareStatus('RESULT SHARED')
      } else {
        await navigator.clipboard.writeText(text)
        setShareStatus('COPIED TO CLIPBOARD')
      }
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') return
      setShareStatus('SHARE UNAVAILABLE')
    }
  }

  return (
    <m.div
      className={`run-outcome run-outcome--${outcome.status}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="run-outcome-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <m.section
        className="run-outcome-card hud-frame"
        initial={{ opacity: 0, scale: 0.92, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.12, type: 'spring', stiffness: 210, damping: 22 }}
      >
        <span className="run-outcome-classification">
          {nation.shortName} // {isWin ? 'DECLASSIFIED DEBRIEF' : 'TERMINAL FAILURE'}
        </span>
        <p className="run-outcome-kicker">
          {isWin ? 'TERM COMPLETE' : 'GAME OVER'}
        </p>
        <h1 id="run-outcome-title">{outcome.title}</h1>
        <p className="run-outcome-cause">{outcome.cause}</p>
        <article className="legacy-card" aria-label="Shareable Legacy Score result">
          <div className="legacy-score-row">
            <span>LEGACY SCORE</span>
            <strong>{String(legacy.score).padStart(3, '0')}</strong>
            <small>/ 100</small>
          </div>
          <div className="legacy-best">
            PERSONAL BEST // {String(bestScore).padStart(3, '0')}
            {isNewBest && <b>NEW BEST</b>}
          </div>
          <p>{legacy.verdict}</p>
          <div className="history-alignment">
            <span>HISTORY ALIGNMENT</span>
            {legacy.alignmentNote}
          </div>
          <div className="real-history-fact">
            <span>REAL FACT // JULY 2026</span>
            {legacy.realFact}
          </div>
        </article>
        <div className="run-outcome-actions">
          <button type="button" onClick={() => void shareResult()}>
            {shareStatus}
          </button>
          <button type="button" onClick={onRestart}>
            NEW RUN // RESET TIMELINE
          </button>
        </div>
      </m.section>
    </m.div>
  )
}
