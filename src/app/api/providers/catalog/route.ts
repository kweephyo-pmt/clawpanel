import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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

  const errors: string[] = []

  // Try 1: openclaw models list --json
  try {
    const { stdout: raw } = await execAsync(`${bin} models list --json`, {
      encoding: 'utf-8',
      timeout: 25000,
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
    errors.push('models list returned empty')
  } catch (e: any) { 
    errors.push('models list err: ' + (e?.message || String(e))) 
  }

  // Try 2: Direct file read of OpenClaw config
  try {
    const fs = require('fs')
    const path = require('path')
    
    // First ask CLI where the config is, fallback to default UNIX path
    let configPath = ''
    try {
      const { stdout: configPathRaw } = await execAsync(`${bin} config file`, { encoding: 'utf-8', timeout: 5000 })
      configPath = configPathRaw.trim()
    } catch {
      configPath = path.join(process.env.HOME || '', '.openclaw', 'config.json')
    }

    // Node `fs` doesn't resolve `~/` automatically, so we must expand it!
    if (configPath.startsWith('~/')) {
      configPath = path.join(process.env.HOME || '', configPath.slice(2))
    } else if (configPath === '~') {
      configPath = process.env.HOME || ''
    }

    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const config = JSON.parse(raw)
      const providersSection = (config?.models?.providers || config?.providers) as Record<string, { models?: any[] }> | undefined
      
      if (providersSection) {
        const models: ModelEntry[] = []
        for (const [providerId, providerConf] of Object.entries(providersSection)) {
          for (const modelItem of providerConf?.models ?? []) {
            let modelId = ''
            let modelLabel = ''
            if (typeof modelItem === 'string') {
              modelId = modelItem
              modelLabel = modelItem
            } else if (modelItem && typeof modelItem === 'object') {
              modelId = String(modelItem.id || '')
              modelLabel = String(modelItem.name || modelItem.label || modelId)
            }
            if (!modelId) continue
            
            const fullId = modelId.includes('/') ? modelId : `${providerId}/${modelId}`
            models.push({ id: fullId, label: modelLabel || fullId, provider: providerId })
          }
        }
        if (models.length > 0) return saveCacheAndReturn(models)
        errors.push('Disk config providers section had no properly formatted models')
      } else {
        errors.push('Disk config completely missing providers section')
      }
    } else {
      errors.push('Disk config file not found at ' + configPath)
    }
  } catch (e: any) { 
    errors.push('config file err: ' + (e?.message || String(e))) 
  }

  // All attempts failed — return empty, let the UI show "No models found"
  return NextResponse.json({ models: [], error: 'Could not retrieve models from OpenClaw CLI', details: errors })
}
