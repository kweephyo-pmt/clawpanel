import { CronJob, CronDelivery } from '@/lib/types'
import { execSync } from 'child_process'
import { parseSchedule, describeCron } from './cron-utils'
import { requireEnv } from '@/lib/env'
import { loadRegistry } from '@/lib/agents-registry'

/**
 * Match a cron job name to an agent by prefix.
 * Tries each known agent ID as a prefix (longest first to avoid
 * partial matches, e.g. "seo-team" matches before "seo").
 */
function matchAgent(name: string, agentIds: string[]): string | null {
  const sorted = [...agentIds].sort((a, b) => b.length - a.length)
  for (const id of sorted) {
    if (name === id || name.startsWith(id + '-')) return id
  }
  return null
}

export async function getCrons(): Promise<CronJob[]> {
  try {
    const openclawBin = requireEnv('OPENCLAW_BIN')

    // Try --all flag first (fetches both enabled and disabled).
    // Fall back to merging enabled + disabled calls if --all isn't supported.
    let raw: string
    try {
      raw = execSync(`${openclawBin} cron list --all --json`, {
        encoding: 'utf-8',
        timeout: 10000,
      })
    } catch {
      // --all not supported: fetch enabled and disabled separately and merge
      const enabledRaw = execSync(`${openclawBin} cron list --json`, {
        encoding: 'utf-8',
        timeout: 10000,
      })
      let disabledRaw = '[]'
      try {
        disabledRaw = execSync(`${openclawBin} cron list --disabled --json`, {
          encoding: 'utf-8',
          timeout: 10000,
        })
      } catch { /* disabled flag may not exist either — skip */ }
      const enabled = JSON.parse(enabledRaw)
      const disabled = JSON.parse(disabledRaw)
      const enabledArr: unknown[] = Array.isArray(enabled) ? enabled : (enabled.jobs ?? enabled.data ?? [])
      const disabledArr: unknown[] = Array.isArray(disabled) ? disabled : (disabled.jobs ?? disabled.data ?? [])
      // Merge, dedup by id/name
      const seen = new Set<string>()
      const merged: unknown[] = []
      for (const item of [...enabledArr, ...disabledArr]) {
        const j = item as Record<string, unknown>
        const key = String(j.id || j.name || '')
        if (!seen.has(key)) { seen.add(key); merged.push(item) }
      }
      raw = JSON.stringify(merged)
    }

    const parsed = JSON.parse(raw)
    const jobs: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed.jobs ?? parsed.data ?? []

    // Load known agent IDs for dynamic cron-to-agent matching
    const agentIds = loadRegistry().map(a => a.id)

    return jobs.map((job: unknown) => {
      const j = job as Record<string, unknown>
      const state = (j.state as Record<string, unknown>) || {}
      const name = String(j.name || '')
      const { expression: schedule, timezone } = parseSchedule(j.schedule)

      // Status can be in state.status or directly on j.status
      const rawStatus = state.status ?? j.status ?? ''
      let status: 'ok' | 'error' | 'idle' = 'idle'
      if (rawStatus === 'error' || rawStatus === 'failed') {
        status = 'error'
      } else if (rawStatus === 'ok' || rawStatus === 'success' || rawStatus === 'completed') {
        status = 'ok'
      }

      // nextRun: try state.nextRunAtMs first, then state.nextRunAt
      const nextRunMs = state.nextRunAtMs ?? state.nextRunAt ?? j.nextRunAtMs ?? j.nextRunAt
      const nextRun = nextRunMs
        ? new Date(Number(nextRunMs)).toISOString()
        : null

      // lastRun: try state.lastRunAtMs, state.lastRunAt, or top-level equivalents
      const lastRunRaw = state.lastRunAtMs ?? state.lastRunAt ?? j.lastRunAtMs ?? j.lastRunAt ?? j.last
      const lastRun = lastRunRaw
        ? (typeof lastRunRaw === 'number' ? new Date(lastRunRaw).toISOString() : String(lastRunRaw))
        : null

      const lastError = (state.lastError ?? state.error ?? j.lastError) ? String(state.lastError ?? state.error ?? j.lastError) : null

      // Delivery config
      const rawDelivery = j.delivery as Record<string, unknown> | undefined
      let delivery: CronDelivery | null = null
      if (rawDelivery && typeof rawDelivery === 'object') {
        delivery = {
          mode: String(rawDelivery.mode || ''),
          channel: String(rawDelivery.channel || ''),
          to: rawDelivery.to ? String(rawDelivery.to) : null,
        }
      }

      // Rich state fields
      const lastDurationMs = typeof state.lastDurationMs === 'number' ? state.lastDurationMs : null
      const consecutiveErrors = typeof state.consecutiveErrors === 'number' ? state.consecutiveErrors : 0
      const lastDeliveryStatus = typeof state.lastDeliveryStatus === 'string' ? state.lastDeliveryStatus : null

      // Payload: agentTurn has .message, systemEvent has .text
      const rawPayload = j.payload as Record<string, unknown> | undefined
      const payloadKind = rawPayload?.kind
      const payloadMessage = payloadKind === 'agentTurn' && typeof rawPayload?.message === 'string'
        ? rawPayload.message
        : null
      const payloadSystemEvent = payloadKind === 'systemEvent' && typeof rawPayload?.text === 'string'
        ? rawPayload.text
        : null

      return {
        id: String(j.id || j.name || ''),
        name,
        schedule,
        scheduleDescription: describeCron(schedule),
        timezone,
        status,
        lastRun,
        nextRun,
        lastError,
        agentId: matchAgent(name, agentIds),
        description: typeof j.description === 'string' ? j.description : null,
        enabled: j.enabled !== false,
        delivery,
        lastDurationMs,
        consecutiveErrors,
        lastDeliveryStatus,
        payloadMessage,
        payloadSystemEvent,
      }
    })
  } catch (err) {
    throw new Error(
      `Failed to fetch cron jobs: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
