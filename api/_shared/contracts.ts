import type {
  ConsequenceResponse,
  IntelligenceReport,
} from '../../src/types'

type JsonSchema = Record<string, unknown>

const advisorSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    role: { type: 'string' },
    stance: { type: 'string' },
    line: { type: 'string' },
  },
  required: ['role', 'stance', 'line'],
}

export const intelligenceReportSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    briefing: { type: 'string' },
    threatAssessment: { type: 'string' },
    options: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 3,
    },
    advisors: {
      type: 'array',
      items: advisorSchema,
      minItems: 2,
      maxItems: 2,
    },
  },
  required: ['briefing', 'threatAssessment', 'options', 'advisors'],
}

export const consequenceResponseSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    narrative: { type: 'string' },
    deltas: {
      type: 'object',
      additionalProperties: false,
      properties: {
        approval: { type: 'number', minimum: -25, maximum: 25 },
        treasury: { type: 'number', minimum: -25, maximum: 25 },
        legitimacy: { type: 'number', minimum: -25, maximum: 25 },
        tension: { type: 'number', minimum: -25, maximum: 25 },
      },
      required: ['approval', 'treasury', 'legitimacy', 'tension'],
    },
    spawnedCrisis: {
      anyOf: [intelligenceReportSchema, { type: 'null' }],
    },
  },
  required: ['narrative', 'deltas', 'spawnedCrisis'],
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAdvisor(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.role === 'string' &&
    typeof value.stance === 'string' &&
    typeof value.line === 'string'
  )
}

export function isIntelligenceReport(
  value: unknown,
): value is IntelligenceReport {
  return (
    isRecord(value) &&
    typeof value.briefing === 'string' &&
    typeof value.threatAssessment === 'string' &&
    Array.isArray(value.options) &&
    value.options.length === 3 &&
    value.options.every((option) => typeof option === 'string') &&
    Array.isArray(value.advisors) &&
    value.advisors.length === 2 &&
    value.advisors.every(isAdvisor)
  )
}

function isDelta(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isConsequenceResponse(
  value: unknown,
): value is ConsequenceResponse & { spawnedCrisis?: IntelligenceReport | null } {
  if (!isRecord(value) || !isRecord(value.deltas)) return false

  const spawnedCrisis = value.spawnedCrisis
  return (
    typeof value.narrative === 'string' &&
    isDelta(value.deltas.approval) &&
    isDelta(value.deltas.treasury) &&
    isDelta(value.deltas.legitimacy) &&
    isDelta(value.deltas.tension) &&
    (spawnedCrisis === undefined ||
      spawnedCrisis === null ||
      isIntelligenceReport(spawnedCrisis))
  )
}

export function parseStructuredOutput<T>(
  outputText: string,
  validator: (value: unknown) => value is T,
): T {
  const parsed: unknown = JSON.parse(outputText)
  if (!validator(parsed)) {
    throw new Error('OpenAI returned JSON that did not match the required schema')
  }
  return parsed
}
