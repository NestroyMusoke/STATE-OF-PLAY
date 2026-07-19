import { useMemo, useState } from 'react'
import { m } from 'framer-motion'
import { REAL_HISTORY_FACT } from '../game/legacyScore'
import type { Crisis, DecisionRecord, Headline } from '../types'

type TwoChairDebriefProps = {
  crisis: Crisis
  headline: Headline
  unitedStatesDecision: DecisionRecord
  unitedStatesMeters: Record<string, number>
  venezuelaDecision: DecisionRecord
  venezuelaMeters: Record<string, number>
  onClose: () => void
  onRestart: () => void
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length
}

function scoreMeters(
  unitedStatesMeters: Record<string, number>,
  venezuelaMeters: Record<string, number>,
) {
  const usScore = average([
    unitedStatesMeters.approval ?? 0,
    unitedStatesMeters.treasury ?? 0,
    unitedStatesMeters.legitimacy ?? 0,
    100 - (unitedStatesMeters.tension ?? 100),
  ])
  const venezuelaScore = average([
    venezuelaMeters.sovereignty ?? 0,
    venezuelaMeters.morale ?? 0,
    venezuelaMeters.reconstruction ?? 0,
    venezuelaMeters.foreignSupport ?? 0,
  ])
  return Math.max(0, Math.min(100, Math.round((usScore + venezuelaScore) / 2)))
}

function verdict(score: number) {
  if (score >= 75) return 'You bent the crisis without breaking either state.'
  if (score >= 55) return 'Both governments endured, but the shared timeline carries visible scars.'
  if (score >= 35) return 'Your decisions stabilized one chair by transferring pressure to the other.'
  return 'The crisis escaped both governments and began writing its own history.'
}

export function TwoChairDebrief({
  crisis,
  headline,
  unitedStatesDecision,
  unitedStatesMeters,
  venezuelaDecision,
  venezuelaMeters,
  onClose,
  onRestart,
}: TwoChairDebriefProps) {
  const score = useMemo(
    () => scoreMeters(unitedStatesMeters, venezuelaMeters),
    [unitedStatesMeters, venezuelaMeters],
  )
  const [shareStatus, setShareStatus] = useState('SHARE THIS TIMELINE')

  async function shareTimeline() {
    const text = [
      'STATE OF PLAY // TWO-CHAIR DEBRIEF',
      crisis.title,
      `Shared Legacy Score: ${score}/100`,
      `Washington: ${unitedStatesDecision.chosenOption}`,
      `Caracas: ${venezuelaDecision.chosenOption}`,
      verdict(score),
      `Real history: ${REAL_HISTORY_FACT}`,
    ].join('\n')

    try {
      if (navigator.share) {
        await navigator.share({ title: 'STATE OF PLAY timeline', text })
        setShareStatus('TIMELINE SHARED')
      } else {
        await navigator.clipboard.writeText(text)
        setShareStatus('COPIED TO CLIPBOARD')
      }
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        setShareStatus('SHARE UNAVAILABLE')
      }
    }
  }

  return (
    <m.div
      className="two-chair-debrief"
      role="dialog"
      aria-modal="true"
      aria-labelledby="two-chair-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <m.section
        className="two-chair-debrief__card hud-frame"
        initial={{ opacity: 0, y: 28, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.12, type: 'spring', stiffness: 190, damping: 22 }}
      >
        <span className="two-chair-debrief__classification">
          SHARED CRISIS // WASHINGTON ↔ CARACAS
        </span>
        <p className="two-chair-debrief__kicker">ONE EVENT. TWO CHAIRS. ONE TIMELINE.</p>
        <h1 id="two-chair-title">{crisis.title}</h1>
        <div className="two-chair-debrief__source">
          <span>REAL EVENT // {headline.source.toUpperCase()}</span>
          <strong>{headline.title}</strong>
        </div>

        <div className="two-chair-timeline">
          <article>
            <span>01 // WASHINGTON ORDER</span>
            <strong>{unitedStatesDecision.chosenOption}</strong>
            <p>{unitedStatesDecision.narrative}</p>
          </article>
          <i aria-hidden="true">CAUSED</i>
          <article>
            <span>02 // CARACAS RESPONSE</span>
            <strong>{venezuelaDecision.chosenOption}</strong>
            <p>{venezuelaDecision.narrative}</p>
          </article>
        </div>

        <div className="two-chair-score">
          <span>SHARED LEGACY SCORE</span>
          <strong>{String(score).padStart(3, '0')}</strong>
          <small>/ 100</small>
          <p>{verdict(score)}</p>
        </div>

        <aside className="two-chair-history">
          <span>WHAT REAL HISTORY RECORDED</span>
          <p>{REAL_HISTORY_FACT}</p>
        </aside>

        <div className="two-chair-actions">
          <button type="button" onClick={() => void shareTimeline()}>
            {shareStatus}
          </button>
          <button type="button" onClick={onClose}>RETURN TO MAP</button>
          <button type="button" onClick={onRestart}>REPLAY THE TIMELINE</button>
        </div>
      </m.section>
    </m.div>
  )
}
