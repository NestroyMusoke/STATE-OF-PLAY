import { m } from 'framer-motion'
import type { Headline } from '../types'

type OnboardingOverlayProps = {
  headline: Headline
  mode?: 'cold-open' | 'help'
  onClose: () => void
}

function eventTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'TIME UNCONFIRMED'
    : `${date.toISOString().slice(0, 10)} // ${date.toISOString().slice(11, 16)}Z`
}

export function OnboardingOverlay({
  headline,
  mode = 'cold-open',
  onClose,
}: OnboardingOverlayProps) {
  const isColdOpen = mode === 'cold-open'
  return (
    <m.div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="opening-impact" aria-hidden="true">
        <m.div
          className="opening-impact__flash"
          initial={{ opacity: 0, scale: 0.08 }}
          animate={{ opacity: [0, 1, 0.22, 0], scale: [0.08, 0.3, 1.8, 3.2] }}
          transition={{ delay: 0.25, duration: 1.45, times: [0, 0.12, 0.55, 1] }}
        />
        <m.div
          className="opening-impact__ring"
          initial={{ opacity: 0, scale: 0.05 }}
          animate={{ opacity: [0, 0.85, 0], scale: [0.05, 0.55, 2.5] }}
          transition={{ delay: 0.42, duration: 1.55, ease: 'easeOut' }}
        />
        <m.span
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ delay: 0.1, duration: 2.15, times: [0, 0.12, 0.72, 1] }}
        >
          SIMULATED FUTURE // NUCLEAR ESCALATION
        </m.span>
      </div>

      <m.section
        className="onboarding-card hud-frame"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.65, duration: 0.48 }}
      >
        <span className="onboarding-classification">
          {isColdOpen
            ? 'STATE OF PLAY // INCOMING PRESIDENTIAL BRIEF'
            : 'STATE OF PLAY // HOW TO PLAY'}
        </span>
        <p className="onboarding-kicker">THE HEADLINE IS REAL. THE NEXT MOVE IS YOURS.</p>
        <h1 id="onboarding-title">
          {isColdOpen ? 'THE WORLD NEEDS YOUR ANSWER.' : 'YOU CONTROL THE RESPONSE.'}
        </h1>
        <article className="cold-open-headline">
          <span>REAL EVENT // {headline.source.toUpperCase()} // {eventTime(headline.publishedAt)}</span>
          <strong>{headline.title}</strong>
        </article>
        <p className="onboarding-summary">
          {isColdOpen
            ? 'You are the President. Two advisors are waiting. Choose the response, absorb the consequences, then face the same event from Caracas.'
            : 'Every crisis begins with a real event. Hear both advisors, commit one response, and keep the nation stable as the world reacts.'}
        </p>
        <div className="onboarding-stakes">
          <strong>THIS IS NOT A QUIZ.</strong>
          <span>Your approval can collapse. Diplomacy can fail. A regional crisis can become a war.</span>
        </div>
        <button type="button" onClick={onClose} autoFocus>
          {isColdOpen ? 'RESPOND TO THIS CRISIS' : 'RETURN TO THE MAP'}
        </button>
      </m.section>
    </m.div>
  )
}
