import type { IncomingMessage, ServerResponse } from 'node:http'
import { NATIONS } from '../src/game/nations.js'
import type {
  BriefingPriorContext,
  BriefingRequest,
  Crisis,
  IntelligenceReport,
  NationId,
  NationPromptContext,
} from '../src/types.js'
import { isIntelligenceReport } from './_shared/contracts.js'
import {
  briefingModel,
  callLiveBriefing,
  resolveAiRuntime,
} from './_shared/generation.js'
import {
  cacheResponse,
  createCacheKey,
  getCachedResponse,
  logApiPath,
  reserveAiCall,
} from './_shared/runtime.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNationId(value: unknown): value is NationId {
  return value === 'united-states' || value === 'venezuela'
}

function isCrisis(value: unknown): value is Crisis {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.location === 'string' &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length === 2 &&
    value.coordinates.every((coordinate) => typeof coordinate === 'number') &&
    ['military', 'humanitarian', 'economic', 'diplomatic'].includes(
      String(value.type),
    ) &&
    typeof value.intelFragment === 'string'
  )
}

function isPerspective(value: unknown): value is NationPromptContext {
  return (
    isRecord(value) &&
    isNationId(value.nationId) &&
    typeof value.nationName === 'string' &&
    typeof value.seat === 'string' &&
    isRecord(value.meters) &&
    Array.isArray(value.advisors) &&
    value.advisors.length === 2
  )
}

function isPriorContext(value: unknown): value is BriefingPriorContext {
  return (
    isRecord(value) &&
    value.sourceNationId === 'united-states' &&
    typeof value.triggeringDecisionId === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.causalityCallout === 'string'
  )
}

function isBriefingRequest(value: unknown): value is BriefingRequest {
  return (
    isRecord(value) &&
    isCrisis(value.crisis) &&
    isPerspective(value.perspective) &&
    (value.headlineId === undefined || typeof value.headlineId === 'string') &&
    (value.priorContext === undefined || isPriorContext(value.priorContext))
  )
}

async function readRequestBody(request: IncomingMessage) {
  let rawBody = ''
  for await (const chunk of request) {
    rawBody += chunk.toString()
    if (rawBody.length > 64_000) throw new Error('Request body is too large')
  }
  if (!rawBody) return null
  return JSON.parse(rawBody) as unknown
}

function advisorsFor(nationId: NationId): IntelligenceReport['advisors'] {
  const [first, second] = NATIONS[nationId].advisors
  return [{ ...first }, { ...second }]
}

export function fallbackReport(
  nationId: NationId,
  priorContext?: BriefingPriorContext,
): IntelligenceReport {
  if (nationId === 'venezuela') {
    return {
      briefing:
        priorContext
          ? `${priorContext.causalityCallout} The shared timeline records the following United States action: ${priorContext.summary} From Caracas, the resulting opening must now be balanced against public morale, reconstruction needs, and Venezuelan sovereignty.`
          : 'From Caracas, the expanding United States role in earthquake recovery presents both immediate relief and a long-term sovereignty test. The interim government must secure reconstruction support without appearing to surrender national control.',
      threatAssessment:
        'HIGH — Public patience is limited, reconstruction capacity is strained, and every agreement with Washington will be judged against Venezuelan sovereignty.',
      options: [
        'Accept targeted relief while retaining Venezuelan command of distribution.',
        'Demand a formal sovereignty framework before expanding cooperation.',
        'Mobilize domestic institutions and reduce reliance on United States support.',
      ],
      advisors: advisorsFor('venezuela'),
    }
  }

  return {
    briefing:
      'Signals indicate a rapidly developing political crisis in Caracas. Field reporting remains incomplete; regional partners are requesting a coordinated United States assessment.',
    threatAssessment:
      'ELEVATED — Short-term instability is likely. Washington must balance humanitarian access, regional credibility, and escalation risk.',
    options: [
      'Request an expanded intelligence briefing.',
      'Open a discreet regional diplomatic channel.',
      'Maintain observation and take no immediate action.',
    ],
    advisors: advisorsFor('united-states'),
  }
}

function sendReport(response: ServerResponse, report: IntelligenceReport) {
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(report))
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  if (request.method !== 'POST') {
    response.statusCode = 405
    response.setHeader('Allow', 'POST')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  let body: unknown
  try {
    body = await readRequestBody(request)
  } catch (error) {
    const report = fallbackReport('united-states')
    logApiPath('llm', { path: 'fallback', reason: 'invalid-request' })
    console.warn('[llm] Invalid request body; serving fallback.', error)
    sendReport(response, report)
    return
  }

  if (!isBriefingRequest(body)) {
    const nationId =
      isRecord(body) &&
      isRecord(body.perspective) &&
      isNationId(body.perspective.nationId)
        ? body.perspective.nationId
        : 'united-states'
    logApiPath('llm', { path: 'fallback', reason: 'invalid-request' })
    sendReport(response, fallbackReport(nationId))
    return
  }

  const nationId = body.perspective.nationId
  const headlineId = body.headlineId ?? body.crisis.id
  const aiRuntime = resolveAiRuntime()
  const provider = aiRuntime?.provider ?? 'fallback'
  const model = aiRuntime ? briefingModel(aiRuntime.provider) : 'fallback'
  const cacheKey = createCacheKey({
    operation: 'briefing',
    provider,
    model,
    nation: nationId,
    crisisId: body.crisis.id,
    headlineId,
    priorContext: body.priorContext ?? null,
  })
  const cached = await getCachedResponse<IntelligenceReport>(cacheKey, !!aiRuntime)

  if (cached && isIntelligenceReport(cached.value)) {
    logApiPath('llm', {
      path: 'cache',
      source: cached.source,
      key: cacheKey,
    })
    sendReport(response, cached.value)
    return
  }

  const fallback = fallbackReport(nationId, body.priorContext)
  if (!aiRuntime) {
    await cacheResponse(cacheKey, fallback, 'fallback-missing-key')
    logApiPath('llm', {
      path: 'fallback',
      reason: 'missing-key',
      key: cacheKey,
    })
    sendReport(response, fallback)
    return
  }

  const budget = await reserveAiCall()
  if (!budget.allowed) {
    await cacheResponse(cacheKey, fallback, 'fallback-daily-limit')
    logApiPath('llm', {
      path: 'fallback',
      reason: 'daily-limit',
      count: budget.count,
      limit: budget.limit,
      key: cacheKey,
    })
    sendReport(response, fallback)
    return
  }

  try {
    logApiPath('llm', {
      path: 'live',
      provider: aiRuntime.provider,
      model,
      count: budget.count,
      limit: budget.limit,
      key: cacheKey,
    })
    const report = await callLiveBriefing(aiRuntime, body, model)
    await cacheResponse(cacheKey, report, 'live')
    sendReport(response, report)
  } catch (error) {
    await cacheResponse(cacheKey, fallback, 'fallback-live-failure')
    logApiPath('llm', {
      path: 'fallback',
      reason: 'live-call-failed',
      provider: aiRuntime.provider,
      model,
      key: cacheKey,
    })
    console.error(
      `[llm] ${aiRuntime.provider} call failed; serving deterministic fallback.`,
      error,
    )
    sendReport(response, fallback)
  }
}
