import type { NationId } from '../types'

export const TERM_LENGTH = 6

export type RunOutcome =
  | {
      status: 'lost'
      title: string
      cause: string
    }
  | {
      status: 'won'
      title: string
      cause: string
    }

type WorldStateSnapshot = {
  turn: number
  meters: Record<string, number>
}

export const FAILURE_DIRECTIVES: Record<NationId, string> = {
  'united-states':
    'FAILURE // APPROVAL 0 · TREASURY 0 · TENSION 100',
  venezuela:
    'FAILURE // SOVEREIGNTY 0 · MORALE 0 · RECONSTRUCTION 0 · SUPPORT 0',
}

function value(meters: Record<string, number>, key: string) {
  return meters[key] ?? 0
}

export function evaluateRunOutcome(
  nationId: NationId,
  worldState: WorldStateSnapshot,
): RunOutcome | null {
  const { meters, turn } = worldState

  if (nationId === 'united-states') {
    if (value(meters, 'approval') <= 0) {
      return {
        status: 'lost',
        title: 'REMOVED FROM OFFICE',
        cause: 'Domestic Approval reached zero. Your governing mandate collapsed.',
      }
    }
    if (value(meters, 'tension') >= 100) {
      return {
        status: 'lost',
        title: 'WAR',
        cause: 'Global Tension reached 100. Escalation crossed the point of control.',
      }
    }
    if (value(meters, 'treasury') <= 0) {
      return {
        status: 'lost',
        title: 'ECONOMIC COLLAPSE',
        cause: 'Treasury / Oil Leverage reached zero. The state can no longer sustain its strategy.',
      }
    }
  } else {
    if (value(meters, 'sovereignty') <= 0) {
      return {
        status: 'lost',
        title: 'LOSS OF SELF-RULE',
        cause: 'Sovereignty reached zero. Venezuela no longer controls its own political direction.',
      }
    }
    if (value(meters, 'morale') <= 0) {
      return {
        status: 'lost',
        title: 'UPRISING // REMOVAL',
        cause: 'Public Morale reached zero. The government was removed amid nationwide unrest.',
      }
    }
    if (value(meters, 'reconstruction') <= 0) {
      return {
        status: 'lost',
        title: 'RECOVERY COLLAPSE',
        cause: 'Reconstruction reached zero. National recovery systems failed.',
      }
    }
    if (value(meters, 'foreignSupport') <= 0) {
      return {
        status: 'lost',
        title: 'TOTAL ISOLATION',
        cause: 'Foreign Support reached zero. Venezuela stands without an external partner.',
      }
    }
  }

  if (turn <= TERM_LENGTH) return null

  const allMetersStable = Object.values(meters).every((meter) => meter > 0)
  if (allMetersStable) {
    return {
      status: 'won',
      title: 'TERM SURVIVED',
      cause: `You completed all ${TERM_LENGTH} crisis turns with the nation intact. Debrief authorization granted.`,
    }
  }

  return {
    status: 'lost',
    title: 'TERM FAILED',
    cause: 'The term ended with a critical world-state meter at zero.',
  }
}
