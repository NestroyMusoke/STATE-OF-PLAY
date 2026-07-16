import { useEffect, useRef, useState, type RefObject } from 'react'
import { useCountUp } from 'react-countup'

type SegmentedGaugeProps = {
  compact?: boolean
  label: string
  tone: 'alert' | 'warning' | 'signal'
  value: number
}

const SEGMENTS = 12

export function SegmentedGauge({
  compact = false,
  label,
  tone,
  value,
}: SegmentedGaugeProps) {
  const previousValue = useRef(value)
  const countUpRef = useRef<HTMLSpanElement>(null)
  const [changeDirection, setChangeDirection] = useState<
    'gain' | 'loss' | null
  >(null)

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

    setChangeDirection(value > previousValue.current ? 'gain' : 'loss')
    const timeout = window.setTimeout(() => setChangeDirection(null), 560)
    previousValue.current = value
    return () => window.clearTimeout(timeout)
  }, [value])

  const activeSegments = Math.round((Math.max(0, Math.min(100, value)) / 100) * SEGMENTS)

  return (
    <div
      className={`segmented-gauge gauge--${tone}${compact ? ' segmented-gauge--compact' : ''}${
        changeDirection ? ` gauge--change gauge--${changeDirection}` : ''
      }`}
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
    </div>
  )
}
