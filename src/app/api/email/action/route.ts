import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

const ACCOUNT = 'agent@tbs-marketing.com'

function runCli(args: string): string {
  const bin = requireEnv('OPENCLAW_BIN')
  return execSync(`${bin} ${args}`, { encoding: 'utf-8', timeout: 15000 })
}

function runHimalaya(args: string): string {
  const candidates = [
    `himalaya -a "${ACCOUNT}" ${args}`,
    `himalaya --account "${ACCOUNT}" ${args}`,
    `himalaya ${args}`,
  ]
  let lastErr: unknown
  for (const cmd of candidates) {
    try {
      return execSync(cmd, { encoding: 'utf-8', timeout: 15000 })
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      action: 'run-cron' | 'fetch' | 'mark-read' | 'delete' | 'test-connection'
      cronId?: string
      messageId?: string
    }

    const { action, cronId, messageId } = body

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 })
    }

    let output = ''

    switch (action) {
      case 'run-cron': {
        if (!cronId) return NextResponse.json({ error: 'Missing cronId' }, { status: 400 })
        output = runCli(`cron run "${cronId}" --force`)
        break
      }

      case 'fetch': {
        // Trigger a fresh inbox fetch via himalaya
        const raw = runHimalaya('list --max-width 0 --output json --page-size 20')
        return NextResponse.json({ ok: true, data: raw.trim() })
      }

      case 'mark-read': {
        if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 })
        output = runHimalaya(`flag set "${messageId}" Seen`)
        break
      }

      case 'delete': {
        if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 })
        output = runHimalaya(`message delete "${messageId}"`)
        break
      }

      case 'test-connection': {
        // Test himalaya connectivity by listing just 1 message
        try {
          output = runHimalaya('list --max-width 0 --output json --page-size 1')
          return NextResponse.json({ ok: true, connected: true, output: output.trim() })
        } catch (err) {
          return NextResponse.json({
            ok: false,
            connected: false,
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
