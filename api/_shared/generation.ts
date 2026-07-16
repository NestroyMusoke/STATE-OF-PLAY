import OpenAI from 'openai'
import type {
  BriefingRequest,
  ChosenOption,
  ConsequenceRequest,
  ConsequenceResponse,
  IntelligenceReport,
} from '../../src/types'
import {
  consequenceResponseSchema,
  intelligenceReportSchema,
  isConsequenceResponse,
  isIntelligenceReport,
  parseStructuredOutput,
} from './contracts'

const BRIEFING_MAX_OUTPUT_TOKENS = 1_200
const CONSEQUENCE_MAX_OUTPUT_TOKENS = 1_000

export function briefingModel() {
  return process.env.OPENAI_BRIEFING_MODEL?.trim() || 'gpt-5.6'
}

export function consequenceModel(request: ConsequenceRequest) {
  const fullModel =
    process.env.OPENAI_CONSEQUENCE_MODEL?.trim() || 'gpt-5.6'
  const minorModel = process.env.OPENAI_MINOR_MODEL?.trim() || 'gpt-5.6-luna'
  const optionText = optionLabel(request.chosenOption)
  const isMajor =
    request.crisis.type === 'military' ||
    /strike|force|intervention|sanction|blockade|regime|mobiliz/i.test(optionText)

  return isMajor ? fullModel : minorModel
}

function openAIClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    maxRetries: 0,
    timeout: 25_000,
  })
}

export function optionLabel(option: ChosenOption) {
  return typeof option === 'string'
    ? option
    : `${option.id}: ${option.label} — ${option.summary}`
}

export async function callLiveBriefing(
  apiKey: string,
  request: BriefingRequest,
  model = briefingModel(),
): Promise<IntelligenceReport> {
  const client = openAIClient(apiKey)
  const response = await client.responses.create({
    model,
    store: false,
    reasoning: { effort: 'low' },
    max_output_tokens: BRIEFING_MAX_OUTPUT_TOKENS,
    instructions: [
      'You generate concise geopolitical crisis briefings for the browser strategy game STATE OF PLAY.',
      'Use only the supplied crisis and perspective context. Write from the named nation’s point of view.',
      'Return exactly three distinct policy options and exactly the two supplied advisor personas.',
      'Advisor lines should disagree constructively and remain one sentence each.',
      'Do not add facts, fields, markdown, or commentary outside the required JSON object.',
    ].join(' '),
    input: JSON.stringify(request),
    text: {
      format: {
        type: 'json_schema',
        name: 'state_of_play_briefing',
        strict: true,
        schema: intelligenceReportSchema,
      },
    },
  })

  if (!response.output_text) {
    throw new Error('OpenAI returned no briefing output text')
  }

  return parseStructuredOutput(response.output_text, isIntelligenceReport)
}

type StructuredConsequence = ConsequenceResponse & {
  spawnedCrisis?: IntelligenceReport | null
}

export async function callLiveConsequence(
  apiKey: string,
  request: ConsequenceRequest,
  model = consequenceModel(request),
): Promise<ConsequenceResponse> {
  const client = openAIClient(apiKey)
  const response = await client.responses.create({
    model,
    store: false,
    reasoning: { effort: 'low' },
    max_output_tokens: CONSEQUENCE_MAX_OUTPUT_TOKENS,
    instructions: [
      'You resolve one committed policy decision in the strategy game STATE OF PLAY.',
      'Ground the result only in the supplied crisis, chosen option, perspective, and world state.',
      'Write a concise consequence narrative and conservative meter deltas between -25 and 25.',
      'Use spawnedCrisis only when the decision directly creates an urgent follow-on event; otherwise return null.',
      'Do not add facts, fields, markdown, or commentary outside the required JSON object.',
    ].join(' '),
    input: JSON.stringify({
      ...request,
      chosenOption: optionLabel(request.chosenOption),
    }),
    text: {
      format: {
        type: 'json_schema',
        name: 'state_of_play_consequence',
        strict: true,
        schema: consequenceResponseSchema,
      },
    },
  })

  if (!response.output_text) {
    throw new Error('OpenAI returned no consequence output text')
  }

  const parsed = parseStructuredOutput<StructuredConsequence>(
    response.output_text,
    isConsequenceResponse,
  )

  if (parsed.spawnedCrisis === null) {
    const { spawnedCrisis: _omitted, ...withoutSpawn } = parsed
    return withoutSpawn
  }

  return parsed
}
