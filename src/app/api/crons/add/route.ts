import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
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
      name, schedule, scheduleType, message, systemEvent, description, enabled, agent, tz,
      sessionTarget, sessionKey, wake, timeoutSeconds, modelOverride, thinking, resultDelivery,
      deleteAfterRun, clearAgentOverride, staggerWindow, staggerUnit, exactTiming, accountId,
      lightContext, failureAlerts
    } = body

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

    const args: string[] = ['cron', 'add', '--name', name.trim()]

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
      
      // execution delivery behavior is now decoupled from message itself, but keep fallback
      if (resultDelivery === 'internal') {
        args.push('--no-deliver') // explicitly internal
      } else {
        args.push('--announce') // the typical default when a text message is provided
      }
    } else if (systemEvent?.trim()) {
      args.push('--system-event', systemEvent.trim())
    }

    if (description?.trim()) {
      args.push('--description', description.trim())
    }

    if (enabled === false) {
      args.push('--disabled')
    }

    if (agent?.trim()) {
      args.push('--agent', agent.trim())
    }

    // New Fields Processing
    if (sessionTarget) args.push('--session', sessionTarget)
    if (sessionKey?.trim()) args.push('--session-key', sessionKey.trim())
    if (wake) args.push('--wake', wake)
    
    if (timeoutSeconds) args.push('--timeout-seconds', timeoutSeconds.toString())
    if (modelOverride?.trim()) args.push('--model', modelOverride.trim())
    if (thinking?.trim()) args.push('--thinking', thinking.trim())
    
    if (deleteAfterRun) args.push('--delete-after-run')
    if (clearAgentOverride) {
      // NOTE: "clear agent override" basically means don't set agent, but there's a --clear-agent on edit. 
      // Add can just omit the agent, but let's be safe.
      // add command strictly has agent override implicitly removed by not sending `--agent`
    }
    
    // schedule jitter
    if (scheduleType === 'cron') {
      if (exactTiming) {
        args.push('--exact')
      } else if (staggerWindow?.trim()) {
        const unit = staggerUnit === 'Minutes' ? 'm' : 's'
        args.push('--stagger', `${staggerWindow}${unit}`)
      }
    }
    
    if (accountId?.trim()) args.push('--account', accountId.trim())
    if (lightContext) args.push('--light-context')

    args.push('--json')

    const output = execFileSync(bin, args, { encoding: 'utf-8', timeout: 15000 })

    return NextResponse.json({ ok: true, output: output.trim() })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to create cron job')
  }
}
