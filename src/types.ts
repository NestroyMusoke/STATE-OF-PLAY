export type IntelligenceReport = {
  briefing: string
  threatAssessment: string
  options: [string, string, string]
  advisors: [AdvisorPersona, AdvisorPersona]
}

export type NationId = 'united-states' | 'venezuela'

export type AdvisorPersona = {
  role: string
  stance: string
  line: string
}

export type NationMeterDefinition = {
  key: string
  label: string
  tone: 'alert' | 'warning' | 'signal'
  initial: number
}

export type NationDefinition = {
  id: NationId
  name: string
  shortName: string
  seat: string
  meters: readonly NationMeterDefinition[]
  advisors: readonly [AdvisorPersona, AdvisorPersona]
}

export type NationPromptContext = {
  nationId: NationId
  nationName: string
  seat: string
  meters: Record<string, number>
  advisors: [AdvisorPersona, AdvisorPersona]
}

export type BriefingRequest = {
  crisis: Crisis
  perspective: NationPromptContext
  headlineId?: string
}

export type ChosenOption =
  | string
  | {
      id: string
      label: string
      summary: string
    }

export type ConsequenceRequest = {
  crisis: Crisis
  chosenOption: ChosenOption
  worldState: Record<string, unknown>
  perspective?: NationPromptContext
  headlineId?: string
}

export type ConsequenceResponse = {
  narrative: string
  deltas: {
    approval: number
    treasury: number
    legitimacy: number
    tension: number
  }
  spawnedCrisis?: IntelligenceReport
}

export type Headline = {
  id: string
  title: string
  source: string
  url: string
  publishedAt: string
}

export type CrisisType =
  | 'military'
  | 'humanitarian'
  | 'economic'
  | 'diplomatic'

export type Crisis = {
  id: string
  title: string
  location: string
  coordinates: [number, number]
  type: CrisisType
  intelFragment: string
}
