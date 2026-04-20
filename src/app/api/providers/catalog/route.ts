import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

type ModelEntry = { id: string; label: string; provider: string }

let cachedModels: ModelEntry[] | null = null
let cacheExp = 0

// GET /api/providers/catalog — fetch available models from OpenClaw CLI only
export async function GET() {
  if (cachedModels && Date.now() < cacheExp) {
    return NextResponse.json({ models: cachedModels })
  }

  const bin = process.env.OPENCLAW_BIN || 'openclaw'

  const saveCacheAndReturn = (models: ModelEntry[]) => {
    cachedModels = models
    cacheExp = Date.now() + 60_000 // Cache for 60 seconds
    return NextResponse.json({ models })
  }

  // Try 1: openclaw providers catalog --json
  try {
    const raw = execSync(`${bin} providers catalog --json`, {
      encoding: 'utf-8',
      timeout: 12000,
    })
    const data = JSON.parse(raw)
    const providers = Array.isArray(data) ? data : (data?.providers ?? [])
    const models: ModelEntry[] = []
    for (const provider of providers) {
      const providerId = String(provider.id ?? '')
      for (const model of provider.models ?? []) {
        const modelId = String(model.id ?? '')
        const fullId = modelId.includes('/') ? modelId : `${providerId}/${modelId}`
        models.push({ id: fullId, label: model.label ?? model.name ?? fullId, provider: providerId })
      }
    }
    if (models.length > 0) return saveCacheAndReturn(models)
  } catch { /* try next */ }

  // Try 2: openclaw models list --json
  try {
    const raw = execSync(`${bin} models list --json`, {
      encoding: 'utf-8',
      timeout: 10000,
    })
    const data = JSON.parse(raw)
    const models: ModelEntry[] = (Array.isArray(data) ? data : []).map(
      (m: { id?: string; name?: string; label?: string; provider?: string }) => ({
        id: String(m.id ?? ''),
        label: String(m.label ?? m.name ?? m.id ?? ''),
        provider: String(m.provider ?? (m.id ?? '').toString().split('/')[0] ?? ''),
      })
    ).filter((m: ModelEntry) => m.id)
    if (models.length > 0) return saveCacheAndReturn(models)
  } catch { /* try next */ }

  // Try 3: openclaw config show --json — extract provider model lists
  try {
    const raw = execSync(`${bin} config show --json`, { encoding: 'utf-8', timeout: 10000 })
    const config = JSON.parse(raw) as Record<string, unknown>
    const providersSection = config?.providers as Record<string, { models?: string[] }> | undefined
    if (providersSection) {
      const models: ModelEntry[] = []
      for (const [providerId, providerConf] of Object.entries(providersSection)) {
        for (const modelId of providerConf?.models ?? []) {
          const fullId = modelId.includes('/') ? modelId : `${providerId}/${modelId}`
          models.push({ id: fullId, label: fullId, provider: providerId })
        }
      }
      if (models.length > 0) return saveCacheAndReturn(models)
    }
  } catch { /* nothing */ }

  // All attempts failed — return empty, let the UI show "No models found"
  return NextResponse.json({ models: [], error: 'Could not retrieve models from OpenClaw CLI' })
}
