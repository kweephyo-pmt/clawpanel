/**
 * POST /api/email/process
 *
 * Email command processor for agent@tbs-marketing.com (Zoho IMAP via imapflow).
 *
 * Flow:
 *  1. List recent unread emails via imapflow
 *  2. Detect "command" emails — forwarded emails or subjects containing known triggers
 *  3. For each command email:
 *     a. Parse the intent (job type, date range, instructions)
 *     b. Create a parent Kanban ticket + sub-task tickets
 *     c. Mark the email as read (so it's not processed again)
 *     d. Dispatch an OpenClaw agent turn to do the actual work
 *     e. Send an acknowledgement reply email
 *  4. Return a summary of what was processed
 *
 * This route is called by a cron (or manually via the dashboard).
 * It is idempotent — emails already marked Seen are skipped.
 */

import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'
import {
  serverLoadTickets,
  serverSaveTickets,
  serverCreateTicket,
} from '@/lib/kanban/server-store'
import { listEmails, fetchEmailBody, markAsRead, sendEmail } from '@/lib/imap'
import type { EmailMessage } from '@/lib/imap'

export const dynamic = 'force-dynamic'

const MAX_PROCESS = 5 // safety cap per run

// ── OpenClaw helper ───────────────────────────────────────────────────────────

function runOpenClaw(args: string, timeoutMs = 60000): string {
  const bin = process.env.OPENCLAW_BIN
  if (!bin) throw new Error('OPENCLAW_BIN is not set')
  return execSync(`${bin} ${args}`, { encoding: 'utf-8', timeout: timeoutMs })
}

// ── Command detection ─────────────────────────────────────────────────────────

function isCommandEmail(email: EmailMessage): boolean {
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
  jobType: string
  title: string
  dateRange: string | null
  instructions: string
  subTasks: string[]
  priority: 'low' | 'medium' | 'high'
}

function parseIntent(email: EmailMessage & { body: string }): ParsedIntent {
  const sub = email.subject
  const body = email.body

  const dateMatch =
    sub.match(
      /(\d{1,2}(?:st|nd|rd|th)?[\s/-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)?[\s/-]*\d{1,2}(?:st|nd|rd|th)?)/i
    ) ??
    body.match(
      /(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(?:to|–|-)\s+\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)/i
    )
  const dateRange = dateMatch ? dateMatch[1].trim() : null

  const subLower = sub.toLowerCase()
  let jobType = 'task'
  if (subLower.includes('report')) jobType = 'report'
  else if (subLower.includes('brief')) jobType = 'brief'
  else if (subLower.includes('schedule')) jobType = 'schedule'
  else if (subLower.includes('plan')) jobType = 'plan'
  else if (subLower.includes('summary') || subLower.includes('summarise')) jobType = 'summary'

  let title = sub
    .replace(/^(fwd:|fw:|forward:|cmd:)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!title) title = `${jobType.charAt(0).toUpperCase()}${jobType.slice(1)} from ${email.fromName}`

  const instructions = [
    `Job type: ${jobType}`,
    `Requested by: ${email.from}`,
    dateRange ? `Date range: ${dateRange}` : '',
    `Subject: ${sub}`,
    body ? `\nBody:\n${body.slice(0, 2000)}` : '',
  ].filter(Boolean).join('\n')

  const subTaskMap: Record<string, string[]> = {
    report: [
      'Gather data and raw information',
      'Analyze and summarize findings',
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

// ── Agent dispatch ─────────────────────────────────────────────────────────────

function dispatchAgentTurn(intent: ParsedIntent, ticketId: string): string | null {
  try {
    const prompt = [
      'You have received an email job request.',
      '',
      `Job: ${intent.title}`,
      intent.dateRange ? `Date Range: ${intent.dateRange}` : '',
      `Type: ${intent.jobType}`,
      '',
      'Instructions:',
      intent.instructions,
      '',
      `Kanban ticket ID for this job: ${ticketId}`,
      '',
      'Please:',
      '1. Break this into specific sub-tasks',
      '2. Delegate to the appropriate team members / agents',
      '3. Compile the results once all sub-tasks are complete',
      '4. Update the kanban ticket status when done',
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
    // 1. Fetch recent unread emails via imapflow
    const allEmails = await listEmails(20).catch((err: unknown) => {
      throw new Error(
        `Could not connect to IMAP: ${err instanceof Error ? err.message : String(err)}`
      )
    })

    const unread = allEmails.filter(e => !e.isRead)
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

    let store = serverLoadTickets()

    for (const email of commandEmails) {
      // 2. Fetch full body text
      let body = ''
      try {
        body = await fetchEmailBody(email.id)
      } catch {
        body = email.preview
      }
      const emailWithBody = { ...email, body }

      // 3. Parse intent
      const intent = parseIntent(emailWithBody)

      // 4. Create parent Kanban ticket
      const { store: storeAfterParent, id: parentId } = serverCreateTicket(store, {
        title: `📧 ${intent.title}`,
        description: [
          `From: ${email.from}`,
          intent.dateRange ? `Date range: ${intent.dateRange}` : '',
          `Type: ${intent.jobType}`,
          '',
          intent.instructions.slice(0, 500),
        ].filter(Boolean).join('\n'),
        status: 'in-progress',
        priority: intent.priority,
        assigneeId: 'main',
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

      // 7. Mark email as read so it won't be reprocessed
      try {
        await markAsRead(email.id)
      } catch {
        // Best-effort
      }

      // 8. Send acknowledgement reply
      const ackText = [
        `Hi ${email.fromName || 'there'},`,
        '',
        "I've received your request and it's now being processed.",
        '',
        `📋 Job: ${intent.title}`,
        intent.dateRange ? `📅 Date range: ${intent.dateRange}` : '',
        `🏷️  Type: ${intent.jobType}`,
        '',
        `I've created ${intent.subTasks.length} sub-tasks and delegated them to the team. I'll reply again once everything is complete.`,
        '',
        'You can track progress on the Kanban board.',
        '',
        '— TBS Marketing Agent',
      ].filter(s => s !== null).join('\n')

      let replySent = false
      try {
        await sendEmail({
          to: email.from,
          subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
          text: ackText,
        })
        replySent = true
      } catch (err) {
        console.warn('[email-process] Failed to send reply:', err)
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
 * GET /api/email/process — quick status check
 */
export async function GET() {
  return NextResponse.json({
    endpoint: 'POST /api/email/process',
    description: 'Polls Zoho inbox (via IMAP) for command emails and creates Kanban tickets.',
    account: process.env.EMAIL_ADDRESS ?? 'not configured',
    usage: 'POST this endpoint from a cron job or the dashboard to process pending command emails.',
  })
}
