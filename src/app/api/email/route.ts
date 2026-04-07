import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { getCrons } from '@/lib/crons'
import { getCronRuns } from '@/lib/cron-runs'
import { apiErrorResponse } from '@/lib/api-error'
import { loadSkills } from '@/lib/skills'

export const dynamic = 'force-dynamic'

function runCli(args: string): string {
  const bin = requireEnv('OPENCLAW_BIN')
  return execSync(`${bin} ${args}`, { encoding: 'utf-8', timeout: 10000 })
}

export async function GET() {
  try {
    // 1. Find the email processing cron job
    const crons = await getCrons().catch(() => [])
    const emailCron =
      crons.find(
        c =>
          c.name.toLowerCase().includes('email') ||
          c.name.toLowerCase().includes('himalaya') ||
          c.name.toLowerCase().includes('inbox'),
      ) ?? null

    // 2. Fetch run history for this cron (last 20 runs)
    const allRuns = emailCron ? getCronRuns(emailCron.id).slice(0, 20) : []

    // 3. Check if the himalaya skill is loaded in OpenClaw
    const skills = loadSkills()
    const himalayaSkill = skills.find(s => s.id === 'himalaya') ?? null

    // 4. Check agent config — is the email cron bound to an agent?
    let agentConfig: { id: string; name: string } | null = null
    if (emailCron?.agentId) {
      agentConfig = { id: emailCron.agentId, name: emailCron.agentId }
    }

    // 5. Derive processing stats from run history
    const successRuns = allRuns.filter(r => r.status === 'ok')
    const errorRuns = allRuns.filter(r => r.status === 'error')
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)
    const runsToday = allRuns.filter(r => r.ts >= todayMidnight.getTime())
    const avgDurationMs =
      successRuns.length > 0
        ? Math.round(successRuns.reduce((s, r) => s + r.durationMs, 0) / successRuns.length)
        : null

    // 6. Check gateway connectivity (non-fatal)
    let gatewayOnline = false
    try {
      runCli('channels status --json')
      gatewayOnline = true
    } catch {
      gatewayOnline = false
    }

    return NextResponse.json({
      cron: emailCron,
      runs: allRuns,
      himalayaSkill,
      agentConfig,
      gatewayOnline,
      stats: {
        totalRuns: allRuns.length,
        successRuns: successRuns.length,
        errorRuns: errorRuns.length,
        runsToday: runsToday.length,
        avgDurationMs,
      },
      account: 'agent@tbs-marketing.com',
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load email processing data')
  }
}
