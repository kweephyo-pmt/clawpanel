import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      id: string
      action: 'enable' | 'disable' | 'trigger' | 'delete' | 'run' | 'run-due' | 'remove'
    }

    const { id, action } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing cron id' }, { status: 400 })
    }

    const bin = requireEnv('OPENCLAW_BIN')
    const args = ['cron', action, id]
    
    if (action === 'trigger') {
      args[1] = 'run'
    } else if (action === 'delete') {
      args[1] = 'remove'
    } else if (action === 'run-due') {
      args[1] = 'run'
      args.push('--due')
    }

    let output = ''
    try {
      output = execFileSync(bin, args, { encoding: 'utf-8', timeout: 30000 })
    } catch (e: any) {
      output = (e.stdout || '') + (e.stderr || '')
      if (!output) throw e
      
      // run --due successfully completes but returns exit code 1 if it wasn't due
      if (action === 'run-due' && e.status === 1) {
        // This is a normal "skipped" status for run-due
      } else {
        return NextResponse.json({ error: output.trim() || 'Command failed' }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true, output: output.trim() })
  } catch (err) {
    return apiErrorResponse(err, `Failed to perform action on cron`)
  }
}
