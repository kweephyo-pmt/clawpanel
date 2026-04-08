import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      id: string
      name: string
      schedule: string          // cron expression, e.g. "0 8 * * *"
      scheduleType: 'cron' | 'every' | 'at'
      message?: string
      systemEvent?: string
      description?: string
      enabled?: boolean
      agent?: string
      tz?: string
    }

    const { id, name, schedule, scheduleType, message, systemEvent, description, enabled, agent, tz } = body

    if (!id?.trim()) {
      return NextResponse.json({ error: 'Missing cron id' }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    }
    if (!schedule?.trim()) {
      return NextResponse.json({ error: 'Missing schedule' }, { status: 400 })
    }
    if (!message?.trim() && !systemEvent?.trim()) {
      return NextResponse.json({ error: 'Provide either message or systemEvent' }, { status: 400 })
    }

    const bin = requireEnv('OPENCLAW_BIN')

    const args: string[] = ['cron', 'edit', id.trim(), '--name', name.trim()]

    // Schedule type
    if (scheduleType === 'cron') {
      args.push('--cron', schedule.trim())
    } else if (scheduleType === 'every') {
      args.push('--every', schedule.trim())
    } else {
      args.push('--at', schedule.trim())
    }

    if (tz?.trim()) {
      args.push('--tz', tz.trim())
    }

    if (message?.trim()) {
      args.push('--message', message.trim())
      args.push('--announce')
    } else if (systemEvent?.trim()) {
      args.push('--system-event', systemEvent.trim())
    }

    if (description?.trim()) {
      args.push('--description', description.trim())
    }

    if (enabled === false) {
      args.push('--disable')
    } else if (enabled === true) {
      args.push('--enable')
    }

    if (agent?.trim()) {
      args.push('--agent', agent.trim())
    }

    const output = execFileSync(bin, args, { encoding: 'utf-8', timeout: 15000 })

    return NextResponse.json({ ok: true, output: output.trim() })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update cron job')
  }
}
