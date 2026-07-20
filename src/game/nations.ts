import type {
  AdvisorPersona,
  NationDefinition,
  NationId,
  NationPromptContext,
} from '../types.js'

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
      {
        key: 'approval',
        label: 'Domestic Approval',
        description: 'Public support for your administration. At zero, you are removed from office.',
        tone: 'signal',
        initial: 62,
      },
      {
        key: 'treasury',
        label: 'Treasury / Oil Leverage',
        description: 'Economic capacity and leverage over energy policy. At zero, the strategy collapses.',
        tone: 'warning',
        initial: 68,
      },
      {
        key: 'legitimacy',
        label: 'Global Legitimacy',
        description: 'International trust in US leadership and coalition credibility.',
        tone: 'signal',
        initial: 58,
      },
      {
        key: 'tension',
        label: 'Global Tension',
        description: 'Escalation pressure across the crisis. At 100, war begins.',
        tone: 'alert',
        initial: 42,
      },
    ],
    advisors: UNITED_STATES_ADVISORS,
  },
  venezuela: {
    id: 'venezuela',
    name: 'Venezuela',
    shortName: 'VEN',
    seat: 'Caracas',
    meters: [
      {
        key: 'sovereignty',
        label: 'Sovereignty',
        description: 'Venezuela’s control over its own political direction. At zero, self-rule is lost.',
        tone: 'warning',
        initial: 54,
      },
      {
        key: 'morale',
        label: 'Public Morale',
        description: 'Public confidence and social stability. At zero, uprising removes the government.',
        tone: 'signal',
        initial: 48,
      },
      {
        key: 'reconstruction',
        label: 'Reconstruction',
        description: 'National recovery capacity after the earthquakes. At zero, recovery systems fail.',
        tone: 'signal',
        initial: 31,
      },
      {
        key: 'foreignSupport',
        label: 'Foreign Support',
        description: 'Diplomatic, financial, and humanitarian backing abroad. At zero, Venezuela is isolated.',
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
