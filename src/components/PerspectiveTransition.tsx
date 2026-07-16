import { m } from 'framer-motion'

type PerspectiveTransitionProps = {
  targetLetterhead: string
}

export function PerspectiveTransition({ targetLetterhead }: PerspectiveTransitionProps) {
  return (
    <m.div
      className="perspective-wipe"
      initial={{ clipPath: 'inset(50% 0 50% 0)', opacity: 0 }}
      animate={{
        clipPath: ['inset(50% 0 50% 0)', 'inset(0% 0 0% 0)', 'inset(0% 0 0% 0)'],
        opacity: [0, 1, 1],
      }}
      exit={{ clipPath: 'inset(50% 0 50% 0)', opacity: 0 }}
      transition={{ duration: 0.55, times: [0, 0.35, 1] }}
    >
      <div className="crt-tear" />
      <p>SWITCHING PERSPECTIVE</p>
      <m.h2
        initial={{ filter: 'blur(8px)', letterSpacing: '0.5em' }}
        animate={{ filter: 'blur(0px)', letterSpacing: '0.16em' }}
        transition={{ delay: 0.28, duration: 0.42 }}
      >
        {targetLetterhead}
      </m.h2>
      <span>TS//S1TR00M//██//{targetLetterhead}</span>
    </m.div>
  )
}
