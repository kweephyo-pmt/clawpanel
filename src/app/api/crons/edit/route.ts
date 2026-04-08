import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

function escapeArg(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

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

    const parts: string[] = [
      'cron edit',
      `"${id.trim()}"`,
      `--name ${escapeArg(name.trim())}`,
    ]

    // Schedule type
    if (scheduleType === 'cron') {
      parts.push(`--cron ${escapeArg(schedule.trim())}`)
    } else if (scheduleType === 'every') {
      parts.push(`--every ${escapeArg(schedule.trim())}`)
    } else {
      parts.push(`--at ${escapeArg(schedule.trim())}`)
    }

    if (tz?.trim()) {
      parts.push(`--tz ${escapeArg(tz.trim())}`)
    }

    if (message?.trim()) {
      parts.push(`--message ${escapeArg(message.trim())}`)
      parts.push('--announce')
    } else if (systemEvent?.trim()) {
      parts.push(`--system-event ${escapeArg(systemEvent.trim())}`)
    }

    if (description?.trim()) {
      parts.push(`--description ${escapeArg(description.trim())}`)
    }

    if (enabled === false) {
      parts.push('--disable')
    } else if (enabled === true) {
      parts.push('--enable')
    }

    if (agent?.trim()) {
      parts.push(`--agent ${escapeArg(agent.trim())}`)
    }

    parts.push('--json')

    const cmd = `${bin} ${parts.join(' ')}`
    const output = execSync(cmd, { encoding: 'utf-8', timeout: 15000 })

    return NextResponse.json({ ok: true, output: output.trim() })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update cron job')
  }
}