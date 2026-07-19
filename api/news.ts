import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import seedHeadlineData from '../src/data/seedHeadlines.json'
import type { Headline } from '../src/types'

const CACHE_TTL_MS = 60 * 60 * 1000
const SERPAPI_ENDPOINT = 'https://serpapi.com/search'
const GDELT_ENDPOINT = 'https://api.gdeltproject.org/api/v2/doc/doc'
const NEWS_QUERY =
  'Venezuela ("United States" OR "U.S." OR American OR sanctions OR earthquake OR Maduro)'
const DEFAULT_YOUTUBE_CHANNEL_IDS = [
  'UChqUTb7kYRX8-EiaN3XFrSQ', // Reuters
  'UC16niRr50-MSBwiO3YDb3RA', // BBC News
  'UCNye-wNBqNL5ZzHSJj3l8Bg', // Al Jazeera English
  'UCknLrEdhRCp1aegoMqRaCZg', // DW News
]

type CacheEntry = {
  expiresAt: number
  headlines: Headline[]
  mode: 'live' | 'mixed' | 'seed'
}

type SerpApiArticle = {
  title?: unknown
  snippet?: unknown
  link?: unknown
  iso_date?: unknown
  source?: { name?: unknown }
  highlight?: SerpApiArticle
  stories?: SerpApiArticle[]
}

type SerpApiResponse = {
  error?: unknown
  news_results?: unknown
}

type GdeltArticle = {
  title?: unknown
  url?: unknown
  seendate?: unknown
  domain?: unknown
  socialimage?: unknown
}

type GdeltResponse = {
  articles?: unknown
}

let cache: CacheEntry | null = null
const seedHeadlines = (seedHeadlineData as Headline[]).map((headline) => ({
  ...headline,
  kind: 'article' as const,
}))

function stableId(prefix: string, headline: Omit<Headline, 'id'>) {
  return `${prefix}-${createHash('sha256')
    .update(`${headline.title}|${headline.url}|${headline.publishedAt}`)
    .digest('hex')
    .slice(0, 16)}`
}

function isRelevant(text: string) {
  return (
    /venezuela/i.test(text) &&
    /(united states|u\.s\.|american|sanction|earthquake|maduro|caracas)/i.test(
      text,
    )
  )
}

function normalizeSerpArticle(article: SerpApiArticle): Headline | null {
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
  if (!isRelevant(relationText)) return null

  const headline: Omit<Headline, 'id'> = {
    title: article.title,
    source: article.source.name,
    url: article.link,
    publishedAt: article.iso_date,
    kind: 'article',
  }
  return { id: stableId('serpapi', headline), ...headline }
}

function flattenNewsResults(results: SerpApiArticle[]) {
  return results.flatMap((result) => [
    ...(result.highlight ? [result.highlight] : []),
    ...(Array.isArray(result.stories) ? result.stories : []),
    result,
  ])
}

async function fetchSerpApiHeadlines(apiKey: string): Promise<Headline[]> {
  const url = new URL(SERPAPI_ENDPOINT)
  url.searchParams.set('engine', 'google_news')
  url.searchParams.set('q', `${NEWS_QUERY} when:30d`)
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
  if (typeof payload.error === 'string') throw new Error(payload.error)
  if (!Array.isArray(payload.news_results)) return []

  return flattenNewsResults(payload.news_results as SerpApiArticle[])
    .map(normalizeSerpArticle)
    .filter((headline): headline is Headline => headline !== null)
}

function gdeltDate(value: string) {
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T?(\d{2})(\d{2})(\d{2})Z?$/,
  )
  if (!match) return new Date(value).toISOString()
  const [, year, month, day, hour, minute, second] = match
  return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
}

async function fetchGdeltHeadlines(): Promise<Headline[]> {
  const url = new URL(GDELT_ENDPOINT)
  url.searchParams.set('query', NEWS_QUERY)
  url.searchParams.set('mode', 'artlist')
  url.searchParams.set('maxrecords', '25')
  url.searchParams.set('timespan', '30d')
  url.searchParams.set('sort', 'datedesc')
  url.searchParams.set('format', 'json')

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) {
    throw new Error(`GDELT request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as GdeltResponse
  if (!Array.isArray(payload.articles)) return []

  return (payload.articles as GdeltArticle[]).flatMap((article) => {
    if (
      typeof article.title !== 'string' ||
      typeof article.url !== 'string' ||
      typeof article.seendate !== 'string' ||
      typeof article.domain !== 'string' ||
      !isRelevant(article.title)
    ) {
      return []
    }

    const headline: Omit<Headline, 'id'> = {
      title: article.title,
      source: article.domain,
      url: article.url,
      publishedAt: gdeltDate(article.seendate),
      kind: 'article',
      thumbnailUrl:
        typeof article.socialimage === 'string'
          ? article.socialimage
          : undefined,
    }
    return [{ id: stableId('gdelt', headline), ...headline }]
  })
}

function decodeXml(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim()
}

function xmlValue(entry: string, tag: string) {
  const escapedTag = tag.replace(':', '\\:')
  const match = entry.match(
    new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, 'i'),
  )
  return match ? decodeXml(match[1].replace(/<!\[CDATA\[|\]\]>/g, '')) : ''
}

function parseYouTubeFeed(xml: string): Headline[] {
  const channelName = xmlValue(xml, 'title').replace(/^Uploads from /i, '')
  const parsed = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].flatMap(
    ([, entry]) => {
      const videoId = xmlValue(entry, 'yt:videoId')
      const title = xmlValue(entry, 'title')
      const publishedAt = xmlValue(entry, 'published')
      if (!videoId || !title || !publishedAt) return []

      const headline: Omit<Headline, 'id'> = {
        title,
        source: channelName || 'YouTube field source',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt,
        kind: 'video',
        videoId,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      }
      return [{ id: stableId('youtube', headline), ...headline }]
    },
  )
  const relevant = parsed.filter((headline) => isRelevant(headline.title))
  return relevant.length > 0 ? relevant : parsed.slice(0, 1)
}

function youtubeChannelIds() {
  const configured = process.env.YOUTUBE_CHANNEL_IDS?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return configured?.length ? configured : DEFAULT_YOUTUBE_CHANNEL_IDS
}

async function fetchYouTubeHeadlines(): Promise<Headline[]> {
  const results = await Promise.allSettled(
    youtubeChannelIds().map(async (channelId) => {
      const response = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
        {
          headers: { Accept: 'application/atom+xml' },
          signal: AbortSignal.timeout(6_000),
        },
      )
      if (!response.ok) throw new Error(`YouTube RSS status ${response.status}`)
      return parseYouTubeFeed(await response.text())
    }),
  )

  return results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : [],
  )
}

function mergeHeadlines(groups: Headline[][]) {
  return groups
    .flat()
    .filter(
      (headline, index, all) =>
        all.findIndex((candidate) => candidate.url === headline.url) === index,
    )
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, 20)
}

async function getHeadlines() {
  const now = Date.now()
  if (cache && cache.expiresAt > now) return cache

  const requests: Promise<Headline[]>[] = [
    fetchGdeltHeadlines(),
    fetchYouTubeHeadlines(),
  ]
  const serpApiKey = process.env.SERPAPI_KEY?.trim()
  if (serpApiKey) requests.push(fetchSerpApiHeadlines(serpApiKey))

  const settled = await Promise.allSettled(requests)
  const liveHeadlines = mergeHeadlines(
    settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    ),
  )
  settled.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn('[news] Live source failed; continuing with other sources.', result.reason)
    }
  })

  const hasLiveArticles = liveHeadlines.some(
    (headline) => headline.kind !== 'video',
  )
  const hasLiveVideos = liveHeadlines.some(
    (headline) => headline.kind === 'video',
  )
  const mode: CacheEntry['mode'] = hasLiveArticles
    ? 'live'
    : hasLiveVideos
      ? 'mixed'
      : 'seed'

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    headlines:
      mode === 'live'
        ? liveHeadlines
        : mode === 'mixed'
          ? mergeHeadlines([liveHeadlines, seedHeadlines])
          : seedHeadlines,
    mode,
  }
  return cache
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

  const result = await getHeadlines()
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('X-State-Of-Play-News-Mode', result.mode)
  response.setHeader(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=300',
  )
  response.end(JSON.stringify(result.headlines))
}
