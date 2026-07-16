import { useEffect, useRef, useState, type RefObject } from 'react'
import { useCountUp } from 'react-countup'

type SegmentedGaugeProps = {
  label: string
  tone: 'alert' | 'warning' | 'signal'
  value: number
}

const SEGMENTS = 12

export function SegmentedGauge({ label, tone, value }: SegmentedGaugeProps) {
  const previousValue = useRef(value)
  const countUpRef = useRef<HTMLSpanElement>(null)
  const [flash, setFlash] = useState(false)

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

    setFlash(true)
    const timeout = window.setTimeout(() => setFlash(false), 420)
    previousValue.current = value
    return () => window.clearTimeout(timeout)
  }, [value])

  const activeSegments = Math.round((Math.max(0, Math.min(100, value)) / 100) * SEGMENTS)

  return (
    <div className={`segmented-gauge gauge--${tone}${flash ? ' gauge--flash' : ''}`}>
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
