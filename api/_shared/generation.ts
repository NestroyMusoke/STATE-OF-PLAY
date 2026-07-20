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
const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-oss-120b:free'
const OPENAI_DEFAULT_MODEL = 'gpt-5.6'

export type AiProvider = 'openai' | 'openrouter'

export type AiRuntime = {
  provider: AiProvider
  apiKey: string
}

export function resolveAiRuntime(): AiRuntime | null {
  const requestedProvider = process.env.AI_PROVIDER?.trim().toLowerCase()
  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim()

  if (requestedProvider === 'openrouter' && openRouterKey) {
    return { provider: 'openrouter', apiKey: openRouterKey }
  }
  if (requestedProvider === 'openai' && openAiKey) {
    return { provider: 'openai', apiKey: openAiKey }
  }
  if (openAiKey) return { provider: 'openai', apiKey: openAiKey }
  if (openRouterKey) return { provider: 'openrouter', apiKey: openRouterKey }
  return null
}

export function briefingModel(provider: AiProvider) {
  if (provider === 'openai') {
    return (
      process.env.OPENAI_BRIEFING_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      OPENAI_DEFAULT_MODEL
    )
  }

  return (
    process.env.OPENROUTER_BRIEFING_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    OPENROUTER_DEFAULT_MODEL
  )
}

export function consequenceModel(
  request: ConsequenceRequest,
  provider: AiProvider,
) {
  if (provider === 'openai') {
    const fullModel =
      process.env.OPENAI_CONSEQUENCE_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      OPENAI_DEFAULT_MODEL
    const minorModel =
      process.env.OPENAI_MINOR_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      'gpt-5.6-luna'
    return isMajorConsequence(request) ? fullModel : minorModel
  }

  const fullModel =
    process.env.OPENROUTER_CONSEQUENCE_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    OPENROUTER_DEFAULT_MODEL
  const minorModel =
    process.env.OPENROUTER_MINOR_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    OPENROUTER_DEFAULT_MODEL
  return isMajorConsequence(request) ? fullModel : minorModel
}

function isMajorConsequence(request: ConsequenceRequest) {
  const optionText = optionLabel(request.chosenOption)
  return (
    request.crisis.type === 'military' ||
    /strike|force|intervention|sanction|blockade|regime|mobiliz/i.test(optionText)
  )
}

function aiClient(runtime: AiRuntime) {
  const siteUrl = process.env.OPENROUTER_SITE_URL?.trim()
  return new OpenAI({
    apiKey: runtime.apiKey,
    ...(runtime.provider === 'openrouter'
      ? {
          baseURL: 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            ...(siteUrl ? { 'HTTP-Referer': siteUrl } : {}),
            'X-OpenRouter-Title': 'STATE OF PLAY',
          },
        }
      : {}),
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
  runtime: AiRuntime,
  request: BriefingRequest,
  model = briefingModel(runtime.provider),
): Promise<IntelligenceReport> {
  const client = aiClient(runtime)
  const instructions = [
    'You generate concise geopolitical crisis briefings for the browser strategy game STATE OF PLAY.',
    "Use only the supplied crisis and perspective context. Write from the named nation's point of view.",
    'When priorContext is supplied, explicitly connect the briefing, stakes, and options to those recorded decisions; preserve the stated causal direction.',
    'Return exactly three distinct policy options and exactly the two supplied advisor personas.',
    'Advisor lines should disagree constructively and remain one sentence each.',
    'Do not add facts, fields, markdown, or commentary outside the required JSON object.',
  ].join(' ')

  let outputText: string | null | undefined
  if (runtime.provider === 'openai') {
    const response = await client.responses.create({
      model,
      store: false,
      reasoning: { effort: 'low' },
      max_output_tokens: BRIEFING_MAX_OUTPUT_TOKENS,
      instructions,
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
    outputText = response.output_text
  } else {
    const response = await client.chat.completions.create({
      model,
      max_tokens: BRIEFING_MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: instructions },
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
    outputText = response.choices[0]?.message.content
  }

  if (!outputText) {
    throw new Error(`${runtime.provider} returned no briefing output text`)
  }

  return parseStructuredOutput(outputText, isIntelligenceReport)
}

type StructuredConsequence = ConsequenceResponse & {
  spawnedCrisis?: IntelligenceReport | null
}

export async function callLiveConsequence(
  runtime: AiRuntime,
  request: ConsequenceRequest,
  model = consequenceModel(request, runtime.provider),
): Promise<ConsequenceResponse> {
  const client = aiClient(runtime)
  const instructions = [
    'You resolve one committed policy decision in the strategy game STATE OF PLAY.',
    'Ground the result only in the supplied crisis, chosen option, perspective, and world state.',
    'Write a concise consequence narrative and conservative meter deltas between -25 and 25.',
    'For the United States, set sovereignty, morale, reconstruction, and foreignSupport to zero.',
    'For Venezuela, set approval, treasury, legitimacy, and tension to zero.',
    'Use spawnedCrisis only when the decision directly creates an urgent follow-on event; otherwise return null.',
    'Do not add facts, fields, markdown, or commentary outside the required JSON object.',
  ].join(' ')
  const consequenceInput = JSON.stringify({
    ...request,
    chosenOption: optionLabel(request.chosenOption),
  })

  let outputText: string | null | undefined
  if (runtime.provider === 'openai') {
    const response = await client.responses.create({
      model,
      store: false,
      reasoning: { effort: 'low' },
      max_output_tokens: CONSEQUENCE_MAX_OUTPUT_TOKENS,
      instructions,
      input: consequenceInput,
      text: {
        format: {
          type: 'json_schema',
          name: 'state_of_play_consequence',
          strict: true,
          schema: consequenceResponseSchema,
        },
      },
    })
    outputText = response.output_text
  } else {
    const response = await client.chat.completions.create({
      model,
      max_tokens: CONSEQUENCE_MAX_OUTPUT_TOKENS,
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: consequenceInput },
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
    outputText = response.choices[0]?.message.content
  }

  if (!outputText) {
    throw new Error(`${runtime.provider} returned no consequence output text`)
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
