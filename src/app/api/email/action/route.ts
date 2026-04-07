/**
 * POST /api/email/action
 *
 * Actions for the email monitoring dashboard.
 * All actual email work is done by OpenClaw clawbot (himalaya skill).
 * This route only exposes cron control.
 */

import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

function runCli(args: string, timeoutMs = 30000): string {
  const bin = process.env.OPENCLAW_BIN
  if (!bin) throw new Error('OPENCLAW_BIN is not set')
  try {
    return execSync(`${bin} ${args}`, { encoding: 'utf-8', timeout: timeoutMs })
  } catch (err: any) {
    const stderr = err.stderr ? err.stderr.toString() : ''
    const stdout = err.stdout ? err.stdout.toString() : ''
    throw new Error(`CLI Failed\nMessage: ${err.message}\nStdout: ${stdout}\nStderr: ${stderr}`)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      action: 'run-cron' | 'enable-cron' | 'disable-cron'
      cronId?: string
    }

    const { action, cronId } = body

    if (!cronId) {
      return NextResponse.json({ error: 'Missing cronId' }, { status: 400 })
    }

    switch (action) {
      case 'run-cron': {
        const output = runCli(`cron run "${cronId}"`)
        return NextResponse.json({ ok: true, output: output.trim() })
      }

      case 'enable-cron': {
        const output = runCli(`cron enable "${cronId}"`)
        return NextResponse.json({ ok: true, output: output.trim() })
      }

      case 'disable-cron': {
        const output = runCli(`cron disable "${cronId}"`)
        return NextResponse.json({ ok: true, output: output.trim() })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    return apiErrorResponse(err, 'Failed to execute cron action')
  }
}
