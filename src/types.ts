export type IntelligenceReport = {
  briefing: string
  threatAssessment: string
  options: [string, string, string]
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
