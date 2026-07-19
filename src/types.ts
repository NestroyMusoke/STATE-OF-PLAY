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
  description: string
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

export type BriefingPriorContext = {
  sourceNationId: NationId
  triggeringDecisionId: string
  summary: string
  causalityCallout: string
}

export type BriefingRequest = {
  crisis: Crisis
  perspective: NationPromptContext
  headlineId?: string
  priorContext?: BriefingPriorContext
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

export type ConsequenceDeltas = {
    approval: number
    treasury: number
    legitimacy: number
    tension: number
    sovereignty: number
    morale: number
    reconstruction: number
    foreignSupport: number
}

export type ConsequenceResponse = {
  narrative: string
  deltas: ConsequenceDeltas
  spawnedCrisis?: IntelligenceReport
}

export type DecisionRecord = {
  id: string
  nationId: NationId
  crisisId: string
  crisisTitle: string
  chosenOption: string
  narrative: string
  turn: number
  timestamp: string
  deltas: ConsequenceDeltas
}

export type Headline = {
  id: string
  title: string
  source: string
  url: string
  publishedAt: string
  kind?: 'article' | 'video'
  videoId?: string
  thumbnailUrl?: string
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
