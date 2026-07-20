import { createHash } from 'node:crypto'

export type CacheSource =
  | 'live'
  | 'fallback-missing-key'
  | 'fallback-live-failure'
  | 'fallback-daily-limit'

type CacheEntry = {
  createdAt: string
  source: CacheSource
  value: unknown
}

type RuntimeState = {
  version: 1
  responses: Record<string, CacheEntry>
  dailyCalls: {
    date: string
    count: number
  }
}

const HARD_DAILY_LIMIT = 200
const EMPTY_STATE: RuntimeState = {
  version: 1,
  responses: {},
  dailyCalls: { date: '', count: 0 },
}

const state: RuntimeState = structuredClone(EMPTY_STATE)
let mutationQueue: Promise<unknown> = Promise.resolve()

function utcDate() {
  return new Date().toISOString().slice(0, 10)
}

async function loadState() {
  return state
}

function enqueueMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (typeof value !== 'object' || value === null) return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]),
  )
}

export function createCacheKey(parts: Record<string, unknown>) {
  const readablePrefix = [parts.operation, parts.nation, parts.crisisId]
    .filter((part) => typeof part === 'string')
    .join(':')
  const digest = createHash('sha256')
    .update(JSON.stringify(stableValue(parts)))
    .digest('hex')
    .slice(0, 24)
  return `${readablePrefix}:${digest}`
}

export function configuredDailyLimit() {
  const requested = Number.parseInt(
    process.env.OPENROUTER_DAILY_CALL_LIMIT ??
      process.env.OPENAI_DAILY_CALL_LIMIT ??
      `${HARD_DAILY_LIMIT}`,
    10,
  )
  if (!Number.isFinite(requested) || requested < 1) return HARD_DAILY_LIMIT
  return Math.min(requested, HARD_DAILY_LIMIT)
}

export async function getCachedResponse<T>(
  key: string,
  apiKeyPresent: boolean,
): Promise<{ value: T; source: CacheSource } | null> {
  const current = await loadState()
  const entry = current.responses[key]
  if (!entry) return null

  if (!apiKeyPresent) {
    return { value: entry.value as T, source: entry.source }
  }

  const reusable =
    entry.source === 'live' ||
    entry.source === 'fallback-live-failure' ||
    (entry.source === 'fallback-daily-limit' &&
      entry.createdAt.slice(0, 10) === utcDate())

  return reusable ? { value: entry.value as T, source: entry.source } : null
}

export async function cacheResponse(
  key: string,
  value: unknown,
  source: CacheSource,
) {
  await enqueueMutation(async () => {
    const current = await loadState()
    current.responses[key] = {
      createdAt: new Date().toISOString(),
      source,
      value,
    }
  })
}

export async function reserveAiCall() {
  return enqueueMutation(async () => {
    const current = await loadState()
    const today = utcDate()
    if (current.dailyCalls.date !== today) {
      current.dailyCalls = { date: today, count: 0 }
    }

    const limit = configuredDailyLimit()
    if (current.dailyCalls.count >= limit) {
      return {
        allowed: false as const,
        count: current.dailyCalls.count,
        limit,
      }
    }

    current.dailyCalls.count += 1
    return {
      allowed: true as const,
      count: current.dailyCalls.count,
      limit,
    }
  })
}

export function logApiPath(
  endpoint: 'llm' | 'consequence' | 'test:api',
  fields: Record<string, string | number>,
) {
  const detail = Object.entries(fields)
    .map(([key, value]) => `${key}=${String(value).replaceAll(' ', '_')}`)
    .join(' ')
  console.info(`[${endpoint}] ${detail}`)
}
