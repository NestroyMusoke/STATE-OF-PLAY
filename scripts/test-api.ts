import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import type { BriefingRequest } from '../src/types'
import {
  briefingModel,
  callLiveBriefing,
  resolveAiRuntime,
} from '../api/_shared/generation'
import { logApiPath, reserveAiCall } from '../api/_shared/runtime'

if (existsSync('.env')) loadEnvFile('.env')

const aiRuntime = resolveAiRuntime()

if (!aiRuntime) {
  logApiPath('test:api', {
    path: 'skipped',
    reason: 'missing-key',
    requests: 0,
  })
  console.info(
    '[test:api] Add OPENROUTER_API_KEY or OPENAI_API_KEY to .env, then rerun. No API request was sent.',
  )
  process.exit(0)
}

const budget = await reserveAiCall()
if (!budget.allowed) {
  logApiPath('test:api', {
    path: 'blocked',
    reason: 'daily-limit',
    requests: 0,
    count: budget.count,
    limit: budget.limit,
  })
  throw new Error('Daily AI call ceiling reached; no test request was sent.')
}

const request: BriefingRequest = {
  headlineId: 'api-schema-smoke-test',
  crisis: {
    id: 'api-schema-smoke-test',
    title: 'API SCHEMA VERIFICATION',
    location: 'Caracas, Venezuela',
    coordinates: [10.48, -66.9],
    type: 'diplomatic',
    intelFragment: 'Schema verification only.',
  },
  perspective: {
    nationId: 'united-states',
    nationName: 'United States',
    seat: 'Washington',
    meters: {
      approval: 62,
      treasury: 68,
      legitimacy: 58,
      tension: 42,
    },
    advisors: [
      {
        role: 'Secretary of State',
        stance: 'restraint',
        line: 'Preserve diplomatic room for maneuver.',
      },
      {
        role: 'Secretary of Defense',
        stance: 'leverage',
        line: 'Maintain credible options while the situation develops.',
      },
    ],
  },
}

const model = briefingModel(aiRuntime.provider)
logApiPath('test:api', {
  path: 'live',
  provider: aiRuntime.provider,
  model,
  requests: 1,
  count: budget.count,
  limit: budget.limit,
})

const report = await callLiveBriefing(aiRuntime, request, model)

console.info('[test:api] SUCCESS — exactly one request sent and schema validated.')
console.info(
  JSON.stringify(
    {
      model,
      provider: aiRuntime.provider,
      briefingCharacters: report.briefing.length,
      options: report.options.length,
      advisors: report.advisors.map((advisor) => advisor.role),
    },
    null,
    2,
  ),
)
