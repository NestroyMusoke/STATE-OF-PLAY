import type {
  AdvisorPersona,
  NationDefinition,
  NationId,
  NationPromptContext,
} from '../types'

const UNITED_STATES_ADVISORS: [AdvisorPersona, AdvisorPersona] = [
  {
    role: 'Secretary of State',
    stance: 'restraint',
    line: 'Preserve the coalition. Every move must leave room for a negotiated settlement.',
  },
  {
    role: 'Secretary of Defense',
    stance: 'leverage',
    line: 'Credibility comes from options the other side believes we will actually use.',
  },
]

const VENEZUELA_ADVISORS: [AdvisorPersona, AdvisorPersona] = [
  {
    role: 'Foreign Minister',
    stance: 'sovereignty',
    line: 'Accept help where it serves recovery, but concede no control over Venezuela’s future.',
  },
  {
    role: 'Minister of Defense',
    stance: 'stability',
    line: 'The state must remain visible, capable, and in command while the country rebuilds.',
  },
]

export const NATIONS = {
  'united-states': {
    id: 'united-states',
    name: 'United States',
    shortName: 'US',
    seat: 'Washington',
    meters: [
      { key: 'approval', label: 'Domestic Approval', tone: 'signal', initial: 62 },
      {
        key: 'treasury',
        label: 'Treasury / Oil Leverage',
        tone: 'warning',
        initial: 68,
      },
      {
        key: 'legitimacy',
        label: 'Global Legitimacy',
        tone: 'signal',
        initial: 58,
      },
      { key: 'tension', label: 'Global Tension', tone: 'alert', initial: 42 },
    ],
    advisors: UNITED_STATES_ADVISORS,
  },
  venezuela: {
    id: 'venezuela',
    name: 'Venezuela',
    shortName: 'VEN',
    seat: 'Caracas',
    meters: [
      { key: 'sovereignty', label: 'Sovereignty', tone: 'warning', initial: 54 },
      { key: 'morale', label: 'Public Morale', tone: 'signal', initial: 48 },
      {
        key: 'reconstruction',
        label: 'Reconstruction',
        tone: 'signal',
        initial: 31,
      },
      {
        key: 'foreignSupport',
        label: 'Foreign Support',
        tone: 'warning',
        initial: 44,
      },
    ],
    advisors: VENEZUELA_ADVISORS,
  },
} as const satisfies Record<NationId, NationDefinition>

export function getInitialMeters(nationId: NationId) {
  return Object.fromEntries(
    NATIONS[nationId].meters.map((meter) => [meter.key, meter.initial]),
  )
}

export function createNationPromptContext(
  nationId: NationId,
  meters: Record<string, number>,
): NationPromptContext {
  const nation = NATIONS[nationId]
  const [firstAdvisor, secondAdvisor] = nation.advisors

  return {
    nationId,
    nationName: nation.name,
    seat: nation.seat,
    meters,
    advisors: [{ ...firstAdvisor }, { ...secondAdvisor }],
  }
}
