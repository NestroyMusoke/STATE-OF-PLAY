import { useEffect, useState } from 'react'
import { playStaticBlip } from '../audio'

type TypewriterTextProps = {
  onComplete?: () => void
  text: string
}

export function TypewriterText({ onComplete, text }: TypewriterTextProps) {
  const [visibleText, setVisibleText] = useState('')

  useEffect(() => {
    setVisibleText('')
    let cursor = 0
    const interval = window.setInterval(() => {
      cursor += 1
      setVisibleText(text.slice(0, cursor))

      if (cursor % 6 === 0 && text[cursor - 1] !== ' ') playStaticBlip()
      if (cursor >= text.length) {
        window.clearInterval(interval)
        onComplete?.()
      }
    }, 17)

    return () => window.clearInterval(interval)
  }, [onComplete, text])

  return (
    <p className="typewriter-copy">
      {visibleText}
      <span className="transmission-cursor" aria-hidden="true" />
    </p>
  )
}

