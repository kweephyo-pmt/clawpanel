/**
 * POST /api/email/process
 *
 * Email command processor for agent@tbs-marketing.com (Zoho IMAP via himalaya).
 *
 * Flow:
 *  1. List recent unread emails via himalaya
 *  2. Detect "command" emails — forwarded emails or subjects containing known triggers
 *  3. For each command email:
 *     a. Parse the intent (job type, date range, instructions) via OpenClaw agent turn
 *     b. Create a parent Kanban ticket + sub-task tickets
 *     c. Mark the email as read (so it's not processed again)
 *     d. Dispatch an OpenClaw agent turn to do the actual work
 *     e. Send an acknowledgement reply email
 *  4. Return a summary of what was processed
 *
 * This route is called by a cron (or manually via the dashboard).
 * It is idempotent — emails that were already marked Seen are skipped.
 */

import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'
import {
  serverLoadTickets,
  serverSaveTickets,
  serverCreateTicket,
} from '@/lib/kanban/server-store'

export const dynamic = 'force-dynamic'

const ACCOUNT = 'agent@tbs-marketing.com'
const MAX_PROCESS = 5 // safety cap per run

// ── himalaya helpers ──────────────────────────────────────────────────────────

function runHimalaya(args: string, timeoutMs = 20000): string {
  return execSync(`himalaya ${args}`, { encoding: 'utf-8', timeout: timeoutMs })
}

function runOpenClaw(args: string, timeoutMs = 60000): string {
  const bin = process.env.OPENCLAW_BIN
  if (!bin) throw new Error('OPENCLAW_BIN is not set')
  return execSync(`${bin} ${args}`, { encoding: 'utf-8', timeout: timeoutMs })
}

// ── Email parsing ─────────────────────────────────────────────────────────────

interface RawEmail {
  id: string
  subject: string
  from: string
  fromName: string
  flags: string[]
  isRead: boolean
  body: string
}

function parseRawEmails(raw: string): RawEmail[] {
  try {
    const parsed = JSON.parse(raw)
    const list: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed.response ?? parsed.data ?? []

    return list.map((item: unknown) => {
      const m = item as Record<string, unknown>
      const flags = Array.isArray(m.flags) ? (m.flags as string[]) : []
      const isRead = flags.includes('Seen') || flags.includes('\\Seen')

      let from = ''
      let fromName = ''
      const fromRaw = m.from ?? m.sender
      if (typeof fromRaw === 'string') {
        from = fromRaw
        fromName = fromRaw.split('@')[0] ?? fromRaw
      } else if (fromRaw && typeof fromRaw === 'object') {
        const f = fromRaw as Record<string, unknown>
        from = String(f.addr ?? f.email ?? f.address ?? '')
        fromName = String(f.name ?? f.display_name ?? from.split('@')[0] ?? '')
      }

      return {
        id: String(m.id ?? m.uid ?? m.seq ?? ''),
        subject: String(m.subject ?? m.title ?? '(No subject)'),
        from,
        fromName: fromName || from,
        flags,
        isRead,
        body: '',
      }
    })
  } catch {
    return []
  }
}

function fetchBody(id: string): string {
  const argSets = [
    `message read "${id}" --output json`,
    `message read ${id} --output json`,
  ]
  for (const args of argSets) {
    try {
      const raw = runHimalaya(args)
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const msg = (parsed.response ?? parsed) as Record<string, unknown>

      // Try getting parts
      const parts: unknown[] = Array.isArray(msg.parts) ? msg.parts : []
      const bodyFromParts = parts
        .map((p) => {
          const part = p as Record<string, unknown>
          const mime = String(part.mime ?? part.content_type ?? '')
          if (mime.startsWith('text/plain')) {
            return String(part.body ?? part.content ?? part.text ?? '')
          }
          return ''
        })
        .join('')
        .trim()

      if (bodyFromParts) return bodyFromParts
      return String(msg.body ?? msg.text ?? msg.plain ?? '').trim()
    } catch {
      // try next
    }
  }
  return ''
}

// ── Command detection ─────────────────────────────────────────────────────────

/**
 * Detect whether an email is a command for the agent.
 * Heuristics:
 *  - Subject contains known trigger words
 *  - Body starts with "Forwarded message" (classic forward detection)
 *  - Subject starts with "Fwd:", "Forward:", "CMD:"
 */
function isCommandEmail(email: RawEmail): boolean {
  const sub = email.subject.toLowerCase()

  // Explicit command prefixes
  if (/^(fwd:|fw:|forward:|cmd:)/i.test(email.subject)) return true

  // Job-related trigger words in subject
  const triggers = [
    'report', 'prepare', 'create', 'generate', 'compile', 'write',
    'analyse', 'analyze', 'summarise', 'summarize', 'brief',
    'schedule', 'plan', 'task', 'project',
  ]
  if (triggers.some(t => sub.includes(t))) return true

  return false
}

// ── Intent parsing ────────────────────────────────────────────────────────────

interface ParsedIntent {
  jobType: string          // e.g. "report", "schedule", "brief"
  title: string            // clean title for the kanban parent ticket
  dateRange: string | null // e.g. "Apr 15 – May 15"
  instructions: string     // full instructions for the agent
  subTasks: string[]       // suggested sub-tasks
  priority: 'low' | 'medium' | 'high'
}

/**
 * Parse intent from the email subject + body.
 * Uses simple heuristics first; falls back to OpenClaw agent if available.
 */
function parseIntent(email: RawEmail): ParsedIntent {
  const sub = email.subject
  const body = email.body

  // Extract date range patterns like "15th-15th", "Jan 1 to Feb 1", "1/4 - 1/5"
  const dateMatch = sub.match(
    /(\d{1,2}(?:st|nd|rd|th)?[\s/-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?[\s/-]*\d{1,2}(?:st|nd|rd|th)?)/i
  ) ?? body.match(
    /(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(?:to|–|-)\s+\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)/i
  )
  const dateRange = dateMatch ? dateMatch[1].trim() : null

  // Determine job type
  const subLower = sub.toLowerCase()
  let jobType = 'task'
  if (subLower.includes('report')) jobType = 'report'
  else if (subLower.includes('brief')) jobType = 'brief'
  else if (subLower.includes('schedule')) jobType = 'schedule'
  else if (subLower.includes('plan')) jobType = 'plan'
  else if (subLower.includes('summary') || subLower.includes('summarise')) jobType = 'summary'

  // Clean up the subject for use as a title
  let title = sub
    .replace(/^(fwd:|fw:|forward:|cmd:)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title) title = `${jobType.charAt(0).toUpperCase()}${jobType.slice(1)} from ${email.fromName}`

  // Build full instructions for the agent
  const instructions = [
    `Job type: ${jobType}`,
    `Requested by: ${email.from}`,
    dateRange ? `Date range: ${dateRange}` : '',
    `Subject: ${sub}`,
    body ? `\nBody:\n${body.slice(0, 2000)}` : '',
  ].filter(Boolean).join('\n')

  // Suggest sub-tasks based on job type
  const subTaskMap: Record<string, string[]> = {
    report: [
      'Gather data and raw information',
      'Analyse and summarise findings',
      'Format and write report draft',
      'Review and proofread',
      'Send final report',
    ],
    brief: [
      'Research topic and collect materials',
      'Write brief outline',
      'Draft full brief',
      'Review and send',
    ],
    schedule: [
      'Collect availability information',
      'Draft schedule',
      'Confirm and distribute',
    ],
    plan: [
      'Define objectives',
      'Break down into milestones',
      'Assign responsibilities',
      'Write and distribute plan',
    ],
    summary: [
      'Gather source materials',
      'Write summary draft',
      'Review and send',
    ],
    task: [
      'Investigate and plan',
      'Execute task',
      'Review output',
      'Deliver result',
    ],
  }

  return {
    jobType,
    title,
    dateRange,
    instructions,
    subTasks: subTaskMap[jobType] ?? subTaskMap.task,
    priority: 'medium',
  }
}

// ── Email reply ───────────────────────────────────────────────────────────────

function sendReplyEmail(to: string, subject: string, body: string): void {
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`
  const message = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    body,
  ].join('\n')

  // himalaya v1: pipe message to `himalaya message send`
  try {
    execSync('himalaya message send', {
      input: message,
      encoding: 'utf-8',
      timeout: 15000,
    })
  } catch (err) {
    console.warn('[email-process] Failed to send reply email:', err)
  }
}

// ── Agent dispatch ─────────────────────────────────────────────────────────────

/**
 * Dispatch to the main OpenClaw agent with the parsed intent.
 * Uses `openclaw agent turn` (fire-and-forget, non-blocking).
 * Returns the raw CLI output or null on failure.
 */
function dispatchAgentTurn(intent: ParsedIntent, ticketId: string): string | null {
  try {
    const prompt = [
      `You have received an email job request.`,
      ``,
      `Job: ${intent.title}`,
      intent.dateRange ? `Date Range: ${intent.dateRange}` : '',
      `Type: ${intent.jobType}`,
      ``,
      `Instructions:`,
      intent.instructions,
      ``,
      `Kanban ticket ID for this job: ${ticketId}`,
      ``,
      `Please:`,
      `1. Break this into specific sub-tasks`,
      `2. Delegate to the appropriate team members / agents`,
      `3. Compile the results once all sub-tasks are complete`,
      `4. Update the kanban ticket status when done`,
    ].filter(s => s !== null && s !== undefined).join('\n')

    const escaped = prompt.replace(/'/g, "'\\''")
    return runOpenClaw(`agent turn --message '${escaped}'`, 120000)
  } catch (err) {
    console.warn('[email-process] Agent dispatch failed:', err)
    return null
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST() {
  try {
    // 1. Fetch recent unread emails
    let rawList = ''
    const listArgSets = [
      'envelope list --output json --page-size 20',
      'envelope list --output json',
    ]
    let listErr: unknown
    for (const args of listArgSets) {
      try {
        rawList = runHimalaya(args)
        break
      } catch (err) {
        listErr = err
      }
    }
    if (!rawList) {
      return NextResponse.json(
        { ok: false, error: `Could not list emails: ${listErr instanceof Error ? listErr.message : String(listErr)}` },
        { status: 502 }
      )
    }

    const emails = parseRawEmails(rawList)
    const unread = emails.filter(e => !e.isRead)
    const commandEmails = unread.filter(isCommandEmail).slice(0, MAX_PROCESS)

    if (commandEmails.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        skipped: unread.length,
        message: 'No command emails found in unread inbox.',
      })
    }

    const results: Array<{
      emailId: string
      subject: string
      from: string
      ticketId: string
      subTaskIds: string[]
      intent: ParsedIntent
      agentDispatched: boolean
      replySent: boolean
    }> = []

    // Load kanban store once
    let store = serverLoadTickets()

    for (const email of commandEmails) {
      // 2. Fetch full body
      email.body = fetchBody(email.id)

      // 3. Parse intent
      const intent = parseIntent(email)

      // 4. Create parent Kanban ticket
      const { store: storeAfterParent, id: parentId } = serverCreateTicket(store, {
        title: `📧 ${intent.title}`,
        description: [
          `From: ${email.from}`,
          intent.dateRange ? `Date range: ${intent.dateRange}` : '',
          `Type: ${intent.jobType}`,
          ``,
          intent.instructions.slice(0, 500),
        ].filter(Boolean).join('\n'),
        status: 'in-progress',
        priority: intent.priority,
        assigneeId: 'main', // root orchestrator
        workState: 'working',
      })
      store = storeAfterParent

      // 5. Create sub-task tickets
      const subTaskIds: string[] = []
      for (const subTitle of intent.subTasks) {
        const { store: storeAfterSub, id: subId } = serverCreateTicket(store, {
          title: subTitle,
          description: `Sub-task for: ${intent.title}`,
          status: 'todo',
          priority: intent.priority,
          assigneeId: null,
          workState: 'idle',
        })
        store = storeAfterSub
        subTaskIds.push(subId)
      }

      // 6. Persist to disk
      serverSaveTickets(store)

      // Mark email as read so it won't be reprocessed
      try {
        runHimalaya(`flag add "${email.id}" Seen`)
      } catch {
        // Best-effort
      }

      // 8. Send acknowledgement reply
      const ackBody = [
        `Hi ${email.fromName || 'there'},`,
        ``,
        `I've received your request and it's now being processed.`,
        ``,
        `📋 Job: ${intent.title}`,
        intent.dateRange ? `📅 Date range: ${intent.dateRange}` : '',
        `🏷️  Type: ${intent.jobType}`,
        ``,
        `I've created ${intent.subTasks.length} sub-tasks and delegated them to the team. I'll reply again once everything is complete.`,
        ``,
        `You can track progress on the Kanban board.`,
        ``,
        `— TBS Marketing Agent`,
      ].filter(Boolean).join('\n')

      let replySent = false
      try {
        sendReplyEmail(email.from, email.subject, ackBody)
        replySent = true
      } catch {
        // Non-fatal
      }

      // 9. Dispatch OpenClaw agent (non-blocking best-effort)
      const agentOutput = dispatchAgentTurn(intent, parentId)

      results.push({
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        ticketId: parentId,
        subTaskIds,
        intent,
        agentDispatched: agentOutput !== null,
        replySent,
      })
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to process command emails')
  }
}

/**
 * GET /api/email/process — quick status check / manual trigger info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/email/process',
    description: 'Polls Zoho inbox (via himalaya IMAP) for command emails and creates Kanban tickets.',
    account: ACCOUNT,
    usage: 'POST this endpoint from a cron job or the dashboard to process pending command emails.',
  })
}
