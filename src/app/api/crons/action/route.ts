import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      id: string
      action: 'enable' | 'disable' | 'trigger' | 'delete'
    }

    const { id, action } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing cron id' }, { status: 400 })
    }

    const bin = requireEnv('OPENCLAW_BIN')
    const args = ['cron', action, id, '--json']
    
    // Trigger is usually run not trigger
    if (action === 'trigger') {
      args[1] = 'run'
    }

    const output = execFileSync(bin, args, { encoding: 'utf-8', timeout: 30000 })
    
    return NextResponse.json({ ok: true, output: output.trim() })
  } catch (err) {
    return apiErrorResponse(err, `Failed to ${body.action} cron`)
  }
}
