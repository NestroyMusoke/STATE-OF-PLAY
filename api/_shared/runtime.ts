import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

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

let state: RuntimeState | null = null
let loadPromise: Promise<RuntimeState> | null = null
let mutationQueue: Promise<unknown> = Promise.resolve()
let persistenceWarningLogged = false

function utcDate() {
  return new Date().toISOString().slice(0, 10)
}

function runtimeFile() {
  const configuredFile =
    process.env.OPENROUTER_RUNTIME_FILE?.trim() ||
    process.env.OPENAI_RUNTIME_FILE?.trim()
  if (configuredFile) {
    return resolve(configuredFile)
  }

  if (process.env.VERCEL) {
    return join(tmpdir(), 'state-of-play-ai-runtime.json')
  }

  return resolve(process.cwd(), '.state-of-play', 'ai-runtime.json')
}

function isRuntimeState(value: unknown): value is RuntimeState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<RuntimeState>
  return (
    candidate.version === 1 &&
    typeof candidate.responses === 'object' &&
    candidate.responses !== null &&
    typeof candidate.dailyCalls?.date === 'string' &&
    typeof candidate.dailyCalls?.count === 'number'
  )
}

async function loadState() {
  if (state) return state
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const raw = await readFile(runtimeFile(), 'utf8')
      const parsed: unknown = JSON.parse(raw)
      state = isRuntimeState(parsed) ? parsed : structuredClone(EMPTY_STATE)
    } catch {
      state = structuredClone(EMPTY_STATE)
    }
    return state
  })()

  return loadPromise
}

async function persistState(current: RuntimeState) {
  try {
    const file = runtimeFile()
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(current, null, 2), 'utf8')
  } catch (error) {
    if (!persistenceWarningLogged) {
      persistenceWarningLogged = true
      console.warn(
        '[ai-runtime] Persistent cache unavailable; using in-memory cache for this process.',
        error,
      )
    }
  }
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
    await persistState(current)
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
    await persistState(current)
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
