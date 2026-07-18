import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import seedHeadlineData from '../src/data/seedHeadlines.json'
import type { Headline } from '../src/types'

const CACHE_TTL_MS = 60 * 60 * 1000
const SERPAPI_ENDPOINT = 'https://serpapi.com/search'
const NEWS_QUERY =
  'Venezuela ("United States" OR "U.S." OR American OR sanctions OR earthquake OR Maduro) when:30d'

type CacheEntry = {
  expiresAt: number
  headlines: Headline[]
}

type SerpApiArticle = {
  title?: unknown
  snippet?: unknown
  link?: unknown
  iso_date?: unknown
  source?: {
    name?: unknown
  }
  highlight?: SerpApiArticle
  stories?: SerpApiArticle[]
}

type SerpApiResponse = {
  error?: unknown
  news_results?: unknown
}

let cache: CacheEntry | null = null

const seedHeadlines = seedHeadlineData as Headline[]

function stableArticleId(article: Headline) {
  return `serpapi-${createHash('sha256')
    .update(`${article.title}|${article.url}|${article.publishedAt}`)
    .digest('hex')
    .slice(0, 16)}`
}

function normalizeArticle(article: SerpApiArticle): Headline | null {
  if (
    typeof article.title !== 'string' ||
    typeof article.link !== 'string' ||
    typeof article.iso_date !== 'string' ||
    typeof article.source?.name !== 'string'
  ) {
    return null
  }

  const relationText = `${article.title} ${
    typeof article.snippet === 'string' ? article.snippet : ''
  }`

  if (
    !/venezuela/i.test(relationText) ||
    !/(united states|u\.s\.|american|sanction|earthquake|maduro)/i.test(
      relationText,
    )
  ) {
    return null
  }

  const headline: Headline = {
    id: '',
    title: article.title,
    source: article.source.name,
    url: article.link,
    publishedAt: article.iso_date,
  }

  headline.id = stableArticleId(headline)
  return headline
}

function flattenNewsResults(results: SerpApiArticle[]) {
  return results.flatMap((result) => [
    ...(result.highlight ? [result.highlight] : []),
    ...(Array.isArray(result.stories) ? result.stories : []),
    result,
  ])
}

async function fetchLiveHeadlines(apiKey: string): Promise<Headline[]> {
  const url = new URL(SERPAPI_ENDPOINT)

  url.searchParams.set('engine', 'google_news')
  url.searchParams.set('q', NEWS_QUERY)
  url.searchParams.set('hl', 'en')
  url.searchParams.set('gl', 'us')
  url.searchParams.set('so', '1')
  url.searchParams.set('output', 'json')
  url.searchParams.set('api_key', apiKey)

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  })

  if (!response.ok) {
    throw new Error(`SerpAPI request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as SerpApiResponse
  if (typeof payload.error === 'string') {
    throw new Error(`SerpAPI returned an error: ${payload.error}`)
  }
  if (!Array.isArray(payload.news_results)) {
    throw new Error('SerpAPI returned an invalid news_results payload')
  }

  const headlines = flattenNewsResults(
    payload.news_results as SerpApiArticle[],
  )
    .map(normalizeArticle)
    .filter((headline): headline is Headline => headline !== null)
    .filter(
      (headline, index, all) =>
        all.findIndex((candidate) => candidate.url === headline.url) === index,
    )
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, 10)

  if (headlines.length === 0) {
    throw new Error('SerpAPI returned no matching US-Venezuela headlines')
  }

  return headlines
}

async function getHeadlines() {
  const now = Date.now()

  if (cache && cache.expiresAt > now) {
    return cache.headlines
  }

  const apiKey = process.env.SERPAPI_KEY
  let headlines: Headline[]

  try {
    headlines = apiKey
      ? await fetchLiveHeadlines(apiKey)
      : seedHeadlines
  } catch (error) {
    console.warn('[news] Live ingestion failed; serving bundled seed data.', error)
    headlines = seedHeadlines
  }

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    headlines,
  }

  return headlines
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  if (request.method !== 'GET') {
    response.statusCode = 405
    response.setHeader('Allow', 'GET')
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  const headlines = await getHeadlines()

  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader(
    'X-State-Of-Play-AI-Mode',
    process.env.OPENAI_API_KEY?.trim() ? 'live' : 'fallback',
  )
  response.setHeader(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=300',
  )
  response.end(JSON.stringify(headlines))
}
