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
    const { action, cronId } = await req.json() as {
      action: 'run' | 'run-due' | 'enable' | 'disable' | 'remove'
      cronId: string
    }

    if (!action || !cronId) {
      return NextResponse.json({ error: 'Missing action or cronId' }, { status: 400 })
    }

    let output = ''
    switch (action) {
      case 'run':
        output = runCli(`cron run "${cronId}" --force`)
        break
      case 'run-due':
        output = runCli(`cron run "${cronId}"`)
        break
      case 'enable':
        output = runCli(`cron enable "${cronId}"`)
        break
      case 'disable':
        output = runCli(`cron disable "${cronId}"`)
        break
      case 'remove':
        output = runCli(`cron remove "${cronId}"`)
        break
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, output: output.trim() })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to execute cron action')
  }
}
