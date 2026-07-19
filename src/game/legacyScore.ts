import type { DecisionRecord, NationId } from '../types'

export type LegacyResult = {
  score: number
  verdict: string
  alignmentNote: string
  realFact: string
}

const HISTORY_ALIGNED_PATTERN =
  /aid|relief|reconstruct|sanction|diplomat|cooperat|humanitarian|channel/i

export const REAL_HISTORY_FACT =
  'More than 100 economists called on the United States to lift sanctions after Venezuela’s earthquakes.'

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizedMeters(
  nationId: NationId,
  meters: Record<string, number>,
) {
  if (nationId === 'united-states') {
    return [
      meters.approval ?? 0,
      meters.treasury ?? 0,
      meters.legitimacy ?? 0,
      100 - (meters.tension ?? 100),
    ]
  }

  return [
    meters.sovereignty ?? 0,
    meters.morale ?? 0,
    meters.reconstruction ?? 0,
    meters.foreignSupport ?? 0,
  ]
}

function verdictFor(score: number, won: boolean) {
  if (!won && score < 30) return 'A failed term defined by cascading instability.'
  if (score >= 85) return 'A durable legacy that bent the crisis without breaking the state.'
  if (score >= 65) return 'A credible term—stable, costly, and politically survivable.'
  if (score >= 45) return 'The nation endured, but your mandate carries visible scars.'
  return 'Survival came at a price history will not overlook.'
}

export function calculateLegacyScore(
  nationId: NationId,
  meters: Record<string, number>,
  history: DecisionRecord[],
  won: boolean,
): LegacyResult {
  const nationHistory = history.filter(
    (decision) => decision.nationId === nationId,
  )
  const alignedChoices = nationHistory.filter((decision) =>
    HISTORY_ALIGNED_PATTERN.test(decision.chosenOption),
  ).length
  const alignmentRatio =
    nationHistory.length === 0 ? 0 : alignedChoices / nationHistory.length
  const meterValues = normalizedMeters(nationId, meters)
  const meterAverage =
    meterValues.reduce((total, meter) => total + clamp(meter), 0) /
    meterValues.length
  const survivalModifier = won ? 8 : -12
  const score = clamp(meterAverage * 0.72 + alignmentRatio * 20 + survivalModifier)

  let alignmentNote =
    'Your record diverged from the historical emphasis on relief, reconstruction, diplomacy, and the sanctions debate.'
  if (alignmentRatio >= 0.5) {
    alignmentNote =
      'Your record broadly aligned with history’s emphasis on earthquake relief, reconstruction, diplomacy, and sanctions.'
  } else if (alignmentRatio > 0) {
    alignmentNote =
      'Your record partially echoed the historical relief and sanctions response, then moved onto a different path.'
  }

  return {
    score,
    verdict: verdictFor(score, won),
    alignmentNote,
    realFact: REAL_HISTORY_FACT,
  }
}
