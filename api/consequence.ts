import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  ChosenOption,
  ConsequenceRequest,
  ConsequenceResponse,
  Crisis,
  NationId,
} from '../src/types.js'
import { isConsequenceResponse } from './_shared/contracts.js'
import {
  callLiveConsequence,
  consequenceModel,
  optionLabel,
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

function isChosenOption(value: unknown): value is ChosenOption {
  return (
    typeof value === 'string' ||
    (isRecord(value) &&
      typeof value.id === 'string' &&
      typeof value.label === 'string' &&
      typeof value.summary === 'string')
  )
}

function isConsequenceRequest(value: unknown): value is ConsequenceRequest {
  return (
    isRecord(value) &&
    isCrisis(value.crisis) &&
    isChosenOption(value.chosenOption) &&
    isRecord(value.worldState) &&
    (value.headlineId === undefined || typeof value.headlineId === 'string')
  )
}

function requestNation(request: ConsequenceRequest): NationId {
  return request.perspective?.nationId === 'venezuela'
    ? 'venezuela'
    : 'united-states'
}

async function readRequestBody(request: IncomingMessage) {
  let rawBody = ''
  for await (const chunk of request) {
    rawBody += chunk.toString()
    if (rawBody.length > 96_000) throw new Error('Request body is too large')
  }
  if (!rawBody) return null
  return JSON.parse(rawBody) as unknown
}

export function fallbackConsequence(
  request?: Partial<ConsequenceRequest>,
): ConsequenceResponse {
  const choice = (
    request?.chosenOption
      ? optionLabel(request.chosenOption)
      : 'the selected response'
  ).replace(/[.!?]+$/, '')
  const isVenezuela = request?.perspective?.nationId === 'venezuela'

  return {
    narrative: `The government executes ${choice}. Initial reporting shows limited movement while agencies assess second-order effects.`,
    deltas: {
      approval: isVenezuela ? 0 : 1,
      treasury: isVenezuela ? 0 : -1,
      legitimacy: isVenezuela ? 0 : 1,
      tension: 0,
      sovereignty: isVenezuela ? 1 : 0,
      morale: isVenezuela ? 1 : 0,
      reconstruction: isVenezuela ? -1 : 0,
      foreignSupport: isVenezuela ? 1 : 0,
    },
  }
}

function sendConsequence(
  response: ServerResponse,
  consequence: ConsequenceResponse,
) {
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(consequence))
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
    logApiPath('consequence', { path: 'fallback', reason: 'invalid-request' })
    console.warn('[consequence] Invalid request body; serving fallback.', error)
    sendConsequence(response, fallbackConsequence())
    return
  }

  if (!isConsequenceRequest(body)) {
    logApiPath('consequence', { path: 'fallback', reason: 'invalid-request' })
    sendConsequence(response, fallbackConsequence())
    return
  }

  const nation = requestNation(body)
  const headlineId = body.headlineId ?? body.crisis.id
  const choice = optionLabel(body.chosenOption)
  const aiRuntime = resolveAiRuntime()
  const provider = aiRuntime?.provider ?? 'fallback'
  const model = aiRuntime
    ? consequenceModel(body, aiRuntime.provider)
    : 'fallback'
  const cacheKey = createCacheKey({
    operation: 'consequence',
    provider,
    model,
    nation,
    crisisId: body.crisis.id,
    headlineId,
    chosenOption: choice,
  })
  const cached = await getCachedResponse<ConsequenceResponse>(cacheKey, !!aiRuntime)

  if (cached && isConsequenceResponse(cached.value)) {
    logApiPath('consequence', {
      path: 'cache',
      source: cached.source,
      key: cacheKey,
    })
    sendConsequence(response, cached.value)
    return
  }

  const fallback = fallbackConsequence(body)
  if (!aiRuntime) {
    await cacheResponse(cacheKey, fallback, 'fallback-missing-key')
    logApiPath('consequence', {
      path: 'fallback',
      reason: 'missing-key',
      key: cacheKey,
    })
    sendConsequence(response, fallback)
    return
  }

  const budget = await reserveAiCall()
  if (!budget.allowed) {
    await cacheResponse(cacheKey, fallback, 'fallback-daily-limit')
    logApiPath('consequence', {
      path: 'fallback',
      reason: 'daily-limit',
      count: budget.count,
      limit: budget.limit,
      key: cacheKey,
    })
    sendConsequence(response, fallback)
    return
  }

  try {
    logApiPath('consequence', {
      path: 'live',
      provider: aiRuntime.provider,
      model,
      count: budget.count,
      limit: budget.limit,
      key: cacheKey,
    })
    const consequence = await callLiveConsequence(aiRuntime, body, model)
    await cacheResponse(cacheKey, consequence, 'live')
    sendConsequence(response, consequence)
  } catch (error) {
    await cacheResponse(cacheKey, fallback, 'fallback-live-failure')
    logApiPath('consequence', {
      path: 'fallback',
      reason: 'live-call-failed',
      provider: aiRuntime.provider,
      model,
      key: cacheKey,
    })
    console.error(
      `[consequence] ${aiRuntime.provider} call failed; serving deterministic fallback.`,
      error,
    )
    sendConsequence(response, fallback)
  }
}
