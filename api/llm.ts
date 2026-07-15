import type { IncomingMessage, ServerResponse } from 'node:http'
import type { IntelligenceReport } from '../src/types'

const STUB_REPORT: IntelligenceReport = {
  briefing:
    'Signals indicate a rapidly developing political crisis in Caracas. Field reporting remains incomplete; regional partners are requesting a coordinated assessment.',
  threatAssessment:
    'ELEVATED — Short-term instability is likely. No direct action has been authorized, and confidence in the available intelligence is moderate.',
  options: [
    'Request an expanded intelligence briefing.',
    'Open a discreet regional diplomatic channel.',
    'Maintain observation and take no immediate action.',
  ],
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

  // Server-side only. A future iteration can pass this to the OpenAI SDK.
  // It is intentionally unused while the Day 1 endpoint remains deterministic.
  const openAiApiKey = process.env.OPENAI_API_KEY
  void openAiApiKey

  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(STUB_REPORT))
}
