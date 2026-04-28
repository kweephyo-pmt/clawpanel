import { NextResponse } from 'next/server'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

function getConfigPath() { return join(homedir(), '.openclaw', 'openclaw.json') }
function readConfig(): any {
  const p = getConfigPath()
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return null }
}
function writeConfig(cfg: any) {
  writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf-8')
}
function reloadGateway() {
  const bin = process.env.OPENCLAW_BIN || 'openclaw'
  try { execSync(`${bin} config reload`, { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' }) } catch {}
}

/**
 * DELETE /api/agents/telegram-account?accountId=seo-bot
 * Removes a Telegram account entry + its binding by accountId key.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get('accountId')
    if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })

    const cfg = readConfig()
    if (!cfg) return NextResponse.json({ error: 'openclaw.json not found' }, { status: 404 })

    // Remove account entry
    if (cfg?.channels?.telegram?.accounts?.[accountId]) {
      delete cfg.channels.telegram.accounts[accountId]
    }

    // Remove all bindings pointing to this accountId on the telegram channel
    if (Array.isArray(cfg.bindings)) {
      cfg.bindings = cfg.bindings.filter(
        (b: any) => !(b.match?.channel === 'telegram' && b.match?.accountId === accountId)
      )
    }

    writeConfig(cfg)
    reloadGateway()
    return NextResponse.json({ ok: true, removed: accountId })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to remove telegram account')
  }
}
