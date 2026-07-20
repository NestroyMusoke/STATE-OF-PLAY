import {
  briefingModel,
  resolveAiRuntime,
} from '../api/_shared/generation'

type ProviderCase = {
  name: string
  openAiKey?: string
  openRouterKey?: string
  requestedProvider?: string
  expectedProvider: 'openai' | 'openrouter' | 'fallback'
  expectedModel: string
}

const cases: ProviderCase[] = [
  {
    name: 'no keys',
    expectedProvider: 'fallback',
    expectedModel: 'fallback',
  },
  {
    name: 'OpenRouter only',
    openRouterKey: 'test-openrouter-key',
    expectedProvider: 'openrouter',
    expectedModel: 'openai/gpt-oss-120b:free',
  },
  {
    name: 'OpenAI only',
    openAiKey: 'test-openai-key',
    expectedProvider: 'openai',
    expectedModel: 'gpt-5.6',
  },
  {
    name: 'both keys default to OpenAI',
    openAiKey: 'test-openai-key',
    openRouterKey: 'test-openrouter-key',
    expectedProvider: 'openai',
    expectedModel: 'gpt-5.6',
  },
  {
    name: 'both keys can force OpenRouter',
    openAiKey: 'test-openai-key',
    openRouterKey: 'test-openrouter-key',
    requestedProvider: 'openrouter',
    expectedProvider: 'openrouter',
    expectedModel: 'openai/gpt-oss-120b:free',
  },
]

const original = {
  aiProvider: process.env.AI_PROVIDER,
  openAiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL,
  openRouterKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL,
}

try {
  for (const providerCase of cases) {
    delete process.env.AI_PROVIDER
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_MODEL
    delete process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_MODEL

    if (providerCase.openAiKey) {
      process.env.OPENAI_API_KEY = providerCase.openAiKey
    }
    if (providerCase.openRouterKey) {
      process.env.OPENROUTER_API_KEY = providerCase.openRouterKey
    }
    if (providerCase.requestedProvider) {
      process.env.AI_PROVIDER = providerCase.requestedProvider
    }

    const runtime = resolveAiRuntime()
    const provider = runtime?.provider ?? 'fallback'
    const model = runtime ? briefingModel(runtime.provider) : 'fallback'

    if (
      provider !== providerCase.expectedProvider ||
      model !== providerCase.expectedModel
    ) {
      throw new Error(
        `${providerCase.name}: expected ${providerCase.expectedProvider}/${providerCase.expectedModel}, received ${provider}/${model}`,
      )
    }

    console.info(`[provider-test] PASS // ${providerCase.name} // ${provider} // ${model}`)
  }
} finally {
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  restore('AI_PROVIDER', original.aiProvider)
  restore('OPENAI_API_KEY', original.openAiKey)
  restore('OPENAI_MODEL', original.openAiModel)
  restore('OPENROUTER_API_KEY', original.openRouterKey)
  restore('OPENROUTER_MODEL', original.openRouterModel)
}
