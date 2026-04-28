import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

function readConfig(): any {
  const p = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return null }
}

/**
 * GET /api/agents/telegram-accounts
 * Returns all Telegram accounts from openclaw.json with their binding info.
 */
export async function GET() {
  const cfg = readConfig()
  if (!cfg) return NextResponse.json([])

  const accounts: Record<string, any> = cfg?.channels?.telegram?.accounts ?? {}
  const bindings: any[] = cfg?.bindings ?? []

  const result = Object.entries(accounts).map(([key, acc]: [string, any]) => {
    // Find which agent this account is bound to
    const binding = bindings.find(
      (b: any) => b.match?.channel === 'telegram' && b.match?.accountId === key
    ) ?? null

    return {
      key,
      agentId: binding?.agentId ?? null,
      botToken: acc.botToken ?? '',
      dmPolicy: acc.dmPolicy ?? 'pairing',
      enabled: acc.enabled ?? true,
    }
  })

  return NextResponse.json(result)
}
