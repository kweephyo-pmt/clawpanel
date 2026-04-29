import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// ── In-memory cache so repeated tab visits are instant ──────────────────────
let cachedResult: unknown = null
let cacheExpiresAt = 0
const CACHE_TTL_MS = 15_000 // 15 seconds

function parseChannelStatusText(raw: string) {
  const channelOrder: string[] = []
  const channelLabels: Record<string, string> = {}
  const channelAccounts: Record<string, Array<{
    accountId: string
    enabled: boolean
    configured: boolean
    connected: boolean
    running: boolean
  }>> = {}

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const idMatch = trimmed.match(/^[●○\s]*(\w[\w-]*)/)
    if (!idMatch) continue
    const channelId = idMatch[1].toLowerCase()
    if (channelId === 'channel' || channelId === 'id') continue

    if (!channelOrder.includes(channelId)) {
      channelOrder.push(channelId)
      channelLabels[channelId] = channelId.charAt(0).toUpperCase() + channelId.slice(1)
    }

    const connectedCount  = parseInt(trimmed.match(/(\d+)\s+connected/i)?.[1]  ?? '0')
    const configuredCount = parseInt(trimmed.match(/(\d+)\s+configured/i)?.[1] ?? '0')
    const enabledCount    = parseInt(trimmed.match(/(\d+)\s+enabled/i)?.[1]    ?? '0')

    if (!channelAccounts[channelId]) channelAccounts[channelId] = []
    if ((connectedCount > 0 || configuredCount > 0 || enabledCount > 0) && channelAccounts[channelId].length === 0) {
      channelAccounts[channelId].push({
        accountId: 'default',
        connected: connectedCount > 0,
        configured: configuredCount > 0,
        enabled: enabledCount > 0,
        running: connectedCount > 0,
      })
    }
  }

  return channelOrder.length > 0 ? { channelOrder, channelLabels, channelAccounts } : null
}

// GET /api/agents/channels  - openclaw channels status --json
export async function GET() {
  // Return cached result if still fresh
  if (cachedResult && Date.now() < cacheExpiresAt) {
    return NextResponse.json(cachedResult)
  }

  const bin = process.env.OPENCLAW_BIN || 'openclaw'

  // Hard 5-second timeout for the whole probe — run --json and plain text in parallel,
  // take whichever resolves first with usable data.
  const TIMEOUT_MS = 5000

  const probe = async (args: string) => {
    const { stdout } = await execAsync(`${bin} ${args}`, { encoding: 'utf-8', timeout: TIMEOUT_MS })
    return stdout.trim()
  }

  const deadline = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
  )

  try {
    // Race: both CLI variants vs the hard deadline
    const raw = await Promise.race([
      Promise.any([
        probe('channels status --json'),
        probe('channels status'),
      ]),
      deadline,
    ])

    let result: unknown = null

    if (raw.startsWith('{') || raw.startsWith('[')) {
      result = JSON.parse(raw)
    } else {
      result = parseChannelStatusText(raw)
    }

    if (result) {
      cachedResult = result
      cacheExpiresAt = Date.now() + CACHE_TTL_MS
      return NextResponse.json(result)
    }
  } catch {
    // timeout or all attempts failed
  }

  // Gateway down — return immediately with empty state (don't hang the UI)
  const fallback = {
    channelOrder: [],
    channelLabels: {},
    channelAccounts: {},
    error: 'Gateway unavailable. Run: openclaw gateway run',
  }
  return NextResponse.json(fallback)
}

