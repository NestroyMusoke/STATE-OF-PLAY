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
  return (
    process.env.OPENROUTER_BRIEFING_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    'openai/gpt-oss-120b:free'
  )
}

export function consequenceModel(request: ConsequenceRequest) {
  const fullModel =
    process.env.OPENROUTER_CONSEQUENCE_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    'openai/gpt-oss-120b:free'
  const minorModel =
    process.env.OPENROUTER_MINOR_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    'openai/gpt-oss-120b:free'
  const optionText = optionLabel(request.chosenOption)
  const isMajor =
    request.crisis.type === 'military' ||
    /strike|force|intervention|sanction|blockade|regime|mobiliz/i.test(optionText)

  return isMajor ? fullModel : minorModel
}

function openRouterClient(apiKey: string) {
  const siteUrl = process.env.OPENROUTER_SITE_URL?.trim()
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      ...(siteUrl ? { 'HTTP-Referer': siteUrl } : {}),
      'X-OpenRouter-Title': 'STATE OF PLAY',
    },
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
  const client = openRouterClient(apiKey)
  const response = await client.chat.completions.create({
    model,
    max_tokens: BRIEFING_MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: 'system',
        content: [
          'You generate concise geopolitical crisis briefings for the browser strategy game STATE OF PLAY.',
          "Use only the supplied crisis and perspective context. Write from the named nation's point of view.",
          'When priorContext is supplied, explicitly connect the briefing, stakes, and options to those recorded decisions; preserve the stated causal direction.',
          'Return exactly three distinct policy options and exactly the two supplied advisor personas.',
          'Advisor lines should disagree constructively and remain one sentence each.',
          'Do not add facts, fields, markdown, or commentary outside the required JSON object.',
        ].join(' '),
      },
      { role: 'user', content: JSON.stringify(request) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'state_of_play_briefing',
        strict: true,
        schema: intelligenceReportSchema,
      },
    },
  })

  const outputText = response.choices[0]?.message.content
  if (!outputText) {
    throw new Error('OpenRouter returned no briefing output text')
  }

  return parseStructuredOutput(outputText, isIntelligenceReport)
}

type StructuredConsequence = ConsequenceResponse & {
  spawnedCrisis?: IntelligenceReport | null
}

export async function callLiveConsequence(
  apiKey: string,
  request: ConsequenceRequest,
  model = consequenceModel(request),
): Promise<ConsequenceResponse> {
  const client = openRouterClient(apiKey)
  const response = await client.chat.completions.create({
    model,
    max_tokens: CONSEQUENCE_MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: 'system',
        content: [
          'You resolve one committed policy decision in the strategy game STATE OF PLAY.',
          'Ground the result only in the supplied crisis, chosen option, perspective, and world state.',
          'Write a concise consequence narrative and conservative meter deltas between -25 and 25.',
          'For the United States, set sovereignty, morale, reconstruction, and foreignSupport to zero.',
          'For Venezuela, set approval, treasury, legitimacy, and tension to zero.',
          'Use spawnedCrisis only when the decision directly creates an urgent follow-on event; otherwise return null.',
          'Do not add facts, fields, markdown, or commentary outside the required JSON object.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          ...request,
          chosenOption: optionLabel(request.chosenOption),
        }),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'state_of_play_consequence',
        strict: true,
        schema: consequenceResponseSchema,
      },
    },
  })

  const outputText = response.choices[0]?.message.content
  if (!outputText) {
    throw new Error('OpenRouter returned no consequence output text')
  }

  const parsed = parseStructuredOutput<StructuredConsequence>(
    outputText,
    isConsequenceResponse,
  )

  if (parsed.spawnedCrisis === null) {
    const { spawnedCrisis: _omitted, ...withoutSpawn } = parsed
    return withoutSpawn
  }

  return parsed
}
