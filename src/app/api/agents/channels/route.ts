import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// ── Stale-while-revalidate cache ────────────────────────────────────────────
// Return stale data instantly, refresh in background so next visit is fast.
let cachedResult: unknown = null
let cacheTimestamp = 0
let refreshInFlight = false
const STALE_TTL_MS = 30_000 // start background refresh after 30s
const CLI_TIMEOUT_MS = 12_000 // keep full timeout for the actual probe

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

async function probe(bin: string, args: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`${bin} ${args}`, { encoding: 'utf-8', timeout: CLI_TIMEOUT_MS })
    return stdout.trim()
  } catch (err: any) {
    // execAsync throws on non-zero exit but stdout may still have usable data
    if (err?.stdout && String(err.stdout).trim()) return String(err.stdout).trim()
    throw err
  }
}

async function fetchFreshChannelStatus(bin: string): Promise<unknown | null> {
  try {
    // Run both CLI variants in parallel; first usable result wins
    const raw = await Promise.any([
      probe(bin, 'channels status --json'),
      probe(bin, 'channels status'),
    ])

    if (raw.startsWith('{') || raw.startsWith('[')) {
      return JSON.parse(raw)
    }
    return parseChannelStatusText(raw)
  } catch {
    return null
  }
}

// GET /api/agents/channels
export async function GET() {
  const bin = process.env.OPENCLAW_BIN || 'openclaw'
  const isStale = Date.now() - cacheTimestamp > STALE_TTL_MS

  // ── If we have ANY cached data, return it immediately ──────────────────────
  if (cachedResult) {
    // Kick off a background refresh if data is stale and no refresh is running
    if (isStale && !refreshInFlight) {
      refreshInFlight = true
      fetchFreshChannelStatus(bin)
        .then(result => {
          if (result) {
            cachedResult = result
            cacheTimestamp = Date.now()
          }
        })
        .catch(() => {})
        .finally(() => { refreshInFlight = false })
    }
    // Return stale data immediately — user sees results instantly
    return NextResponse.json(cachedResult)
  }

  // ── Cold start: no cache yet — must wait for the first probe ───────────────
  const result = await fetchFreshChannelStatus(bin)

  if (result) {
    cachedResult = result
    cacheTimestamp = Date.now()
    return NextResponse.json(result)
  }

  // Gateway down
  return NextResponse.json({
    channelOrder: [],
    channelLabels: {},
    channelAccounts: {},
    error: 'Gateway unavailable. Run: openclaw gateway run',
  })
}
