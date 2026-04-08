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
      
      // new fields
      sessionTarget?: 'main' | 'isolated'
      sessionKey?: string
      wake?: 'now' | 'next-heartbeat'
      timeoutSeconds?: number
      modelOverride?: string
      thinking?: string
      resultDelivery?: 'announce' | 'internal'
      deleteAfterRun?: boolean
      clearAgentOverride?: boolean
      staggerWindow?: string
      staggerUnit?: 'Seconds' | 'Minutes'
      exactTiming?: boolean
      accountId?: string
      lightContext?: boolean
      failureAlerts?: string
    }

    const { 
      id, name, schedule, scheduleType, message, systemEvent, description, enabled, agent, tz,
      sessionTarget, sessionKey, wake, timeoutSeconds, modelOverride, thinking, resultDelivery,
      deleteAfterRun, clearAgentOverride, staggerWindow, staggerUnit, exactTiming, accountId,
      lightContext, failureAlerts
    } = body

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

    // Agent payload configs
    if (message?.trim()) {
      args.push('--message', message.trim())
      
      if (resultDelivery === 'internal') {
        args.push('--no-deliver') 
      } else {
        args.push('--announce') 
      }
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

    if (agent?.trim() && !clearAgentOverride) {
      args.push('--agent', agent.trim())
    } else if (clearAgentOverride) {
      args.push('--clear-agent')
    }

    // New Fields Processing
    if (sessionTarget) args.push('--session', sessionTarget)
    
    if (sessionKey?.trim()) {
       args.push('--session-key', sessionKey.trim())
    }

    if (wake) args.push('--wake', wake)
    if (timeoutSeconds) args.push('--timeout-seconds', timeoutSeconds.toString())
    if (modelOverride?.trim()) args.push('--model', modelOverride.trim())
    if (thinking?.trim()) args.push('--thinking', thinking.trim())
    
    if (deleteAfterRun) args.push('--delete-after-run')
    
    // schedule jitter
    if (exactTiming) {
      args.push('--exact')
    } else if (staggerWindow?.trim()) {
      const unit = staggerUnit === 'Minutes' ? 'm' : 's'
      args.push('--stagger', `${staggerWindow}${unit}`)
    }
    
    if (accountId?.trim()) args.push('--account', accountId.trim())
    
    if (lightContext === true) {
       args.push('--light-context')
    } else if (lightContext === false) {
       args.push('--no-light-context')
    }
    
    // failure defaults
    if (failureAlerts === 'disabled') {
       args.push('--no-failure-alert')
    } else if (failureAlerts === 'enabled') {
       args.push('--failure-alert')
    }

    args.push('--json')

    const output = execFileSync(bin, args, { encoding: 'utf-8', timeout: 15000 })

    return NextResponse.json({ ok: true, output: output.trim() })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to edit cron job')
  }
}
