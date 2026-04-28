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
 *
 * Account resolution order:
 *  1. Find a binding where binding.agentId === id AND binding.match.channel === 'telegram'
 *     → use binding.match.accountId to look up the account (handles main/default mismatches)
 *  2. Fall back to accounts[id] (agents created by this panel use agentId as accountId)
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cfg = readConfig()
    if (!cfg) return NextResponse.json({ error: 'openclaw.json not found' }, { status: 404 })

    // 1. Find the telegram binding for this agent
    const binding = (cfg?.bindings ?? []).find(
      (b: any) => b.agentId === id && b.match?.channel === 'telegram'
    ) ?? null

    // 2. Resolve accountId: prefer binding's accountId, fall back to agent id
    const accountId: string = binding?.match?.accountId ?? id

    // 3. Look up the account
    const account =
      cfg?.channels?.telegram?.accounts?.[accountId] ??
      cfg?.channels?.telegram?.accounts?.[id] ??
      null

    return NextResponse.json({
      telegram: account
        ? {
            botToken: account.botToken ?? '',
            dmPolicy: account.dmPolicy ?? 'pairing',
            allowFrom: Array.isArray(account.allowFrom) ? account.allowFrom : [],
            enabled: account.enabled ?? true,
            accountId,  // expose so PATCH knows which key to write
          }
        : null,
      hasBinding: !!binding,
      accountId,
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
 *   { telegram: { botToken, allowFrom: string[], enabled, accountId?: string } }
 *   Pass botToken: "" to remove the entire Telegram account for this agent.
 *   accountId is optional — if omitted the agent ID is used as the account key.
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
        allowFrom: string[]
        enabled: boolean
        accountId?: string  // optional override; if not sent, fall back to agent id
      }
    }

    const cfg = readConfig()
    if (!cfg) return NextResponse.json({ error: 'openclaw.json not found' }, { status: 404 })

    if (body.telegram !== undefined) {
      const { botToken, allowFrom, enabled } = body.telegram

      // Resolve which account key to write to:
      // re-read the binding so we stay consistent with the GET resolution
      const existingBinding = (cfg?.bindings ?? []).find(
        (b: any) => b.agentId === id && b.match?.channel === 'telegram'
      ) ?? null
      const accountId: string = body.telegram.accountId ?? existingBinding?.match?.accountId ?? id

      if (!botToken.trim()) {
        // Remove the account entirely (try both resolved key and agent-id key)
        if (cfg?.channels?.telegram?.accounts) {
          delete cfg.channels.telegram.accounts[accountId]
          delete cfg.channels.telegram.accounts[id]
        }
        // Remove the binding for this agent
        if (Array.isArray(cfg.bindings)) {
          cfg.bindings = cfg.bindings.filter(
            (b: any) => !(b.agentId === id && b.match?.channel === 'telegram')
          )
        }
      } else {
        // Upsert the account
        if (!cfg.channels) cfg.channels = {}
        if (!cfg.channels.telegram) cfg.channels.telegram = {}
        if (!cfg.channels.telegram.accounts) cfg.channels.telegram.accounts = {}

        // Normalise: filter empty strings, deduplicate
        const validIds = [...new Set(
          (Array.isArray(allowFrom) ? allowFrom : [])
            .map((s: string) => s.trim())
            .filter(Boolean)
        )]

        cfg.channels.telegram.accounts[accountId] = {
          botToken: botToken.trim(),
          enabled,
          ...(validIds.length > 0
            ? { dmPolicy: 'allowlist', allowFrom: validIds }
            : { dmPolicy: 'open' }   // no allowlist → open (anyone can chat)
          ),
        }

        // Ensure routing binding exists
        if (!Array.isArray(cfg.bindings)) cfg.bindings = []
        const hasBinding = cfg.bindings.some(
          (b: any) => b.agentId === id && b.match?.channel === 'telegram'
        )
        if (!hasBinding) {
          cfg.bindings.push({
            match: { channel: 'telegram', accountId },
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
