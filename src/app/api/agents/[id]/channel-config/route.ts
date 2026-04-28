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
  try { execSync(`${bin} config reload`, { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' }) } catch { /* non-fatal */ }
}

/**
 * GET /api/agents/[id]/channel-config
 * Returns this agent's Telegram account config from openclaw.json.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cfg = readConfig()
    if (!cfg) return NextResponse.json({ error: 'openclaw.json not found' }, { status: 404 })

    const account = cfg?.channels?.telegram?.accounts?.[id] ?? null
    const binding = (cfg?.bindings ?? []).find(
      (b: any) => b.match?.channel === 'telegram' && b.match?.accountId === id
    ) ?? null

    return NextResponse.json({
      telegram: account
        ? {
            botToken: account.botToken ?? '',
            dmPolicy: account.dmPolicy ?? 'pairing',
            allowFrom: Array.isArray(account.allowFrom) ? account.allowFrom : [],
            enabled: account.enabled ?? true,
          }
        : null,
      hasBinding: !!binding,
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to get channel config')
  }
}

/**
 * PATCH /api/agents/[id]/channel-config
 * Updates (or removes) this agent's Telegram channel account config.
 *
 * Body:
 *   { telegram: { botToken, allowFrom, enabled } }
 *   Pass botToken: "" to remove the entire Telegram account for this agent.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as {
      telegram?: {
        botToken: string
        allowFrom: string   // single user ID string from UI
        enabled: boolean
      }
    }

    const cfg = readConfig()
    if (!cfg) return NextResponse.json({ error: 'openclaw.json not found' }, { status: 404 })

    if (body.telegram !== undefined) {
      const { botToken, allowFrom, enabled } = body.telegram

      if (!botToken.trim()) {
        // Remove the account entirely
        if (cfg?.channels?.telegram?.accounts) {
          delete cfg.channels.telegram.accounts[id]
        }
        // Remove any binding for this agent's telegram account
        if (Array.isArray(cfg.bindings)) {
          cfg.bindings = cfg.bindings.filter(
            (b: any) => !(b.match?.channel === 'telegram' && b.match?.accountId === id)
          )
        }
      } else {
        // Upsert the account
        if (!cfg.channels) cfg.channels = {}
        if (!cfg.channels.telegram) cfg.channels.telegram = {}
        if (!cfg.channels.telegram.accounts) cfg.channels.telegram.accounts = {}

        const trimmedAllowFrom = allowFrom.trim()
        cfg.channels.telegram.accounts[id] = {
          botToken: botToken.trim(),
          enabled,
          ...(trimmedAllowFrom
            ? { dmPolicy: 'allowlist', allowFrom: [trimmedAllowFrom] }
            : { dmPolicy: 'pairing' }
          ),
        }

        // Ensure routing binding exists
        if (!Array.isArray(cfg.bindings)) cfg.bindings = []
        const hasBinding = cfg.bindings.some(
          (b: any) => b.match?.channel === 'telegram' && b.match?.accountId === id
        )
        if (!hasBinding) {
          cfg.bindings.push({
            match: { channel: 'telegram', accountId: id },
            agentId: id,
          })
        }
      }
    }

    writeConfig(cfg)
    reloadGateway()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update channel config')
  }
}
