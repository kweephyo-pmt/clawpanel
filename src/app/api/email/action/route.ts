import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

function runCli(args: string): string {
  const bin = requireEnv('OPENCLAW_BIN')
  return execSync(`${bin} ${args}`, { encoding: 'utf-8', timeout: 15000 })
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      action: 'run-cron' | 'run-cron-due' | 'enable-cron' | 'disable-cron' | 'check-skill'
      cronId?: string
    }

    const { action, cronId } = body

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 })
    }

    let output = ''

    switch (action) {
      case 'run-cron': {
        if (!cronId) return NextResponse.json({ error: 'Missing cronId' }, { status: 400 })
        // Force-run the email cron — OpenClaw agent picks it up and uses the himalaya skill
        output = runCli(`cron run "${cronId}" --force`)
        break
      }

      case 'run-cron-due': {
        if (!cronId) return NextResponse.json({ error: 'Missing cronId' }, { status: 400 })
        // Run only if due
        output = runCli(`cron run "${cronId}"`)
        break
      }

      case 'enable-cron': {
        if (!cronId) return NextResponse.json({ error: 'Missing cronId' }, { status: 400 })
        output = runCli(`cron enable "${cronId}"`)
        break
      }

      case 'disable-cron': {
        if (!cronId) return NextResponse.json({ error: 'Missing cronId' }, { status: 400 })
        output = runCli(`cron disable "${cronId}"`)
        break
      }

      case 'check-skill': {
        // Verify the himalaya skill is loaded in openclaw
        try {
          output = runCli('skills list --json')
          const skills = JSON.parse(output) as Array<{ id: string; enabled?: boolean }>
          const found = skills.find(s => s.id === 'himalaya')
          return NextResponse.json({
            ok: true,
            found: !!found,
            enabled: found?.enabled ?? false,
            output: output.trim(),
          })
        } catch (err) {
          return NextResponse.json({
            ok: false,
            found: false,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, output: output.trim() })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to execute email action')
  }
}
