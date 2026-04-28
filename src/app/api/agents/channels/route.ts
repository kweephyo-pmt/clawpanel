import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

// GET /api/agents/channels  - openclaw channels status --json
export async function GET() {
  const bin = process.env.OPENCLAW_BIN || 'openclaw'

  // Try --json first, fall back to plain text parse
  const attempts: Array<() => string> = [
    () => execSync(`${bin} channels status --json`, { encoding: 'utf-8', timeout: 12000 }),
    () => execSync(`${bin} channels status`, { encoding: 'utf-8', timeout: 12000 }),
  ]

  for (const attempt of attempts) {
    try {
      const raw = attempt().trim()

      // If the output looks like JSON, parse it directly
      if (raw.startsWith('{') || raw.startsWith('[')) {
        const data: unknown = JSON.parse(raw)
        return NextResponse.json(data)
      }

      // Plain text output — parse lines like "telegram  1 connected  1 configured  1 enabled"
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

        // Match lines like: "telegram   1 connected, 1 configured, 1 enabled"
        // or "● telegram  default  connected"
        const idMatch = trimmed.match(/^[●○\s]*(\w[\w-]*)/)
        if (!idMatch) continue
        const channelId = idMatch[1].toLowerCase()
        if (channelId === 'channel' || channelId === 'id') continue // header rows

        if (!channelOrder.includes(channelId)) {
          channelOrder.push(channelId)
          channelLabels[channelId] = channelId.charAt(0).toUpperCase() + channelId.slice(1)
        }

        // Count connected/configured/enabled from summary line numbers
        const connectedCount  = parseInt(trimmed.match(/(\d+)\s+connected/i)?.[1]  ?? '0')
        const configuredCount = parseInt(trimmed.match(/(\d+)\s+configured/i)?.[1] ?? '0')
        const enabledCount    = parseInt(trimmed.match(/(\d+)\s+enabled/i)?.[1]    ?? '0')

        if (!channelAccounts[channelId]) channelAccounts[channelId] = []
        // Synthesise a single summary account entry if we got numbers
        if (connectedCount > 0 || configuredCount > 0 || enabledCount > 0) {
          if (channelAccounts[channelId].length === 0) {
            channelAccounts[channelId].push({
              accountId: 'default',
              connected: connectedCount > 0,
              configured: configuredCount > 0,
              enabled: enabledCount > 0,
              running: connectedCount > 0,
            })
          }
        }
      }

      if (channelOrder.length > 0) {
        return NextResponse.json({ channelOrder, channelLabels, channelAccounts })
      }
      // If we parsed nothing useful, continue to next attempt
    } catch {
      // try next
    }
  }

  // All attempts failed — gateway likely down
  return NextResponse.json({
    channelOrder: [],
    channelLabels: {},
    channelAccounts: {},
    error: 'Gateway unavailable. Run: openclaw gateway run',
  })
}
