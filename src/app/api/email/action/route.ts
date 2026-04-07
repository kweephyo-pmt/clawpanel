import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { markAsRead, deleteEmail, testImapConnection, listEmails } from '@/lib/imap'
import { execSync } from 'child_process'

function runCli(args: string): string {
  const bin = process.env.OPENCLAW_BIN
  if (!bin) throw new Error('OPENCLAW_BIN is not set')
  return execSync(`${bin} ${args}`, { encoding: 'utf-8', timeout: 15000 })
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

    switch (action) {
      case 'run-cron': {
        if (!cronId) return NextResponse.json({ error: 'Missing cronId' }, { status: 400 })
        const output = runCli(`cron run "${cronId}" --force`)
        return NextResponse.json({ ok: true, output: output.trim() })
      }

      case 'fetch': {
        const emails = await listEmails(20)
        return NextResponse.json({ ok: true, data: emails })
      }

      case 'mark-read': {
        if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 })
        await markAsRead(messageId)
        return NextResponse.json({ ok: true })
      }

      case 'delete': {
        if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 })
        await deleteEmail(messageId)
        return NextResponse.json({ ok: true })
      }

      case 'test-connection': {
        const { ok, error } = await testImapConnection()
        return NextResponse.json({ ok, connected: ok, error })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    return apiErrorResponse(err, 'Failed to execute email action')
  }
}
