import { useEffect, useRef, useState, type RefObject } from 'react'
import { useCountUp } from 'react-countup'

type SegmentedGaugeProps = {
  compact?: boolean
  description: string
  label: string
  tone: 'alert' | 'warning' | 'signal'
  value: number
}

const SEGMENTS = 12

export function SegmentedGauge({
  compact = false,
  description,
  label,
  tone,
  value,
}: SegmentedGaugeProps) {
  const previousValue = useRef(value)
  const countUpRef = useRef<HTMLSpanElement>(null)
  const [changeDirection, setChangeDirection] = useState<
    'gain' | 'loss' | null
  >(null)
  const [delta, setDelta] = useState(0)

  useCountUp({
    // react-countup's published ref type predates React 19's nullable RefObject generic.
    ref: countUpRef as unknown as RefObject<HTMLElement>,
    start: 0,
    end: value,
    duration: 1.1,
    enableReinitialize: true,
  })

  useEffect(() => {
    if (previousValue.current === value) return

    const change = value - previousValue.current
    setDelta(change)
    setChangeDirection(change > 0 ? 'gain' : 'loss')
    const timeout = window.setTimeout(() => {
      setChangeDirection(null)
      setDelta(0)
    }, 1_050)
    previousValue.current = value
    return () => window.clearTimeout(timeout)
  }, [value])

  const activeSegments = Math.round((Math.max(0, Math.min(100, value)) / 100) * SEGMENTS)

  return (
    <div
      className={`segmented-gauge gauge--${tone}${compact ? ' segmented-gauge--compact' : ''}${
        changeDirection ? ` gauge--change gauge--${changeDirection}` : ''
      }`}
      tabIndex={0}
      aria-label={`${label}: ${value}%. ${description}`}
    >
      <div className="gauge-meta">
        <span>{label}</span>
        <span><span ref={countUpRef}>0</span>%</span>
      </div>
      <div className="gauge-track" aria-label={`${label}: ${value}%`}>
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span
            className={index < activeSegments ? 'gauge-segment gauge-segment--active' : 'gauge-segment'}
            key={index}
          />
        ))}
      </div>
      <span className="gauge-tooltip" role="tooltip">
        {description}
      </span>
      {delta !== 0 && (
        <span className="gauge-flying-delta" aria-hidden="true">
          {delta > 0 ? '+' : ''}{delta}
        </span>
      )}
    </div>
  )
}
