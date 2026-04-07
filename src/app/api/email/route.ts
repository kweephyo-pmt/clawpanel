import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'
import { getCrons } from '@/lib/crons'

export const dynamic = 'force-dynamic'

export interface EmailAttachment {
  name: string
  mime: string
  size: number
}

export interface EmailMessage {
  id: string
  subject: string
  from: string
  fromName: string
  date: string
  flags: string[]
  isRead: boolean
  isProcessed: boolean
  preview: string
  attachments: EmailAttachment[]
}

/**
 * Run himalaya — account is auto-selected from the himalaya config file.
 * This version of himalaya does not support -a / --account flags.
 */
function runHimalaya(args: string, timeoutMs = 15000): string {
  return execSync(`himalaya ${args}`, { encoding: 'utf-8', timeout: timeoutMs })
}

function parseAttachmentsFromPart(part: unknown): EmailAttachment[] {
  if (!part || typeof part !== 'object') return []
  const p = part as Record<string, unknown>

  // Leaf node with a filename — treat as attachment
  const cdp = p.content_disposition_params as Record<string, unknown> | undefined
  const ctp = p.content_type_params as Record<string, unknown> | undefined
  const filename = String(p.filename ?? p.name ?? cdp?.filename ?? ctp?.name ?? '')
  const mime = String(p.mime ?? p.content_type ?? p.type ?? '')
  const size = typeof p.size === 'number' ? p.size : 0

  const results: EmailAttachment[] = []

  if (filename && !mime.startsWith('text/') && !mime.startsWith('multipart/')) {
    results.push({ name: filename, mime, size })
  }

  // Recurse into sub-parts (multipart)
  const subParts: unknown[] = Array.isArray(p.parts)
    ? p.parts
    : Array.isArray(p.body)
    ? p.body
    : []
  for (const sub of subParts) {
    results.push(...parseAttachmentsFromPart(sub))
  }
  return results
}

function parseHimalayaEmails(raw: string): EmailMessage[] {
  try {
    const parsed = JSON.parse(raw)
    const list: unknown[] = Array.isArray(parsed) ? parsed : parsed.response ?? parsed.data ?? []
    return list.map((item: unknown) => {
      const m = item as Record<string, unknown>
      const flags = Array.isArray(m.flags) ? (m.flags as string[]) : []
      const isRead = flags.includes('Seen') || flags.includes('\\Seen')

      // from may be an object or a string
      let fromStr = ''
      let fromName = ''
      const fromRaw = m.from ?? m.sender
      if (typeof fromRaw === 'string') {
        fromStr = fromRaw
        fromName = fromRaw.split('@')[0] ?? fromRaw
      } else if (fromRaw && typeof fromRaw === 'object') {
        const f = fromRaw as Record<string, unknown>
        fromStr = String(f.addr ?? f.email ?? f.address ?? '')
        fromName = String(f.name ?? f.display_name ?? fromStr.split('@')[0] ?? '')
      }

      const subject = String(m.subject ?? m.title ?? '(No subject)')
      const date = String(m.date ?? m.received ?? '')
      const id = String(m.id ?? m.uid ?? m.seq ?? Math.random())

      // Attachments may already be present in some himalaya versions
      const rawAttachments: unknown[] = Array.isArray(m.attachments)
        ? m.attachments
        : Array.isArray(m.parts)
        ? m.parts
        : []
      const attachments: EmailAttachment[] = rawAttachments.flatMap(parseAttachmentsFromPart)

      // preview is intentionally left empty here — fetchEmailDetails fills it in
      return {
        id,
        subject,
        from: fromStr,
        fromName: fromName || fromStr.split('@')[0] || 'Unknown',
        date,
        flags,
        isRead,
        isProcessed: false,
        preview: '',
        attachments,
      }
    })
  } catch {
    return []
  }
}

/**
 * Extract text body from MIME parts tree.
 */
function extractText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as Record<string, unknown>
  const mime = String(n.mime ?? n.content_type ?? n.type ?? '')
  if (mime.startsWith('text/plain')) {
    return String(n.body ?? n.content ?? n.text ?? '')
  }
  const sub: unknown[] = Array.isArray(n.parts) ? n.parts : []
  return sub.map(extractText).join('')
}

/**
 * Parse a raw attachment record from any himalaya version into our type.
 */
function parseRawAttachment(a: unknown): EmailAttachment | null {
  if (!a || typeof a !== 'object') return null
  const r = a as Record<string, unknown>
  const name = String(r.filename ?? r.name ?? r.file_name ?? '')
  if (!name) return null
  return {
    name,
    mime: String(r.content_type ?? r.mime ?? r.type ?? 'application/octet-stream'),
    size: typeof r.size === 'number' ? r.size : 0,
  }
}

/**
 * Fetch full message details (body + attachments) for a single email id.
 * Uses `himalaya message read <id> --output json` and parses text body
 * plus any attachment parts from the MIME tree.
 */
function fetchEmailDetails(
  id: string,
): { preview: string; attachments: EmailAttachment[] } {
  let preview = ''
  let attachments: EmailAttachment[] = []

  const readArgSets = [
    `message read "${id}" --output json`,
    `message read ${id} --output json`,
  ]

  for (const args of readArgSets) {
    try {
      const raw = runHimalaya(args)
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const msg = (parsed.response ?? parsed) as Record<string, unknown>

      // Body text
      const parts: unknown[] = Array.isArray(msg.parts) ? msg.parts : []
      const bodyText = parts.map(extractText).join('').trim()
        || String(msg.body ?? msg.text ?? msg.plain ?? '')
      preview = bodyText.slice(0, 300)

      // Attachments from top-level array (some versions)
      if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
        attachments = (msg.attachments as unknown[])
          .map(parseRawAttachment)
          .filter((a): a is EmailAttachment => a !== null)
      }

      // Fallback: recurse parts tree for attachment-like nodes
      if (attachments.length === 0 && parts.length > 0) {
        attachments = parts.flatMap(parseAttachmentsFromPart)
      }

      break
    } catch {
      // try next arg set
    }
  }

  return { preview, attachments }
}


export async function GET() {
  try {
    // Fetch the email cron job
    const crons = await getCrons().catch(() => [])
    const emailCron = crons.find(
      c =>
        c.name.toLowerCase().includes('email') ||
        c.name.toLowerCase().includes('himalaya') ||
        c.name.toLowerCase().includes('inbox'),
    )

    // Try to fetch emails via himalaya
    let emails: EmailMessage[] = []
    let himalayaAvailable = false
    let himalayaError: string | null = null
    let totalCount = 0

    try {
      // Check binary exists
      execSync('himalaya --version', { encoding: 'utf-8', timeout: 5000 })

      // Build list args
      let raw = ''
      const listArgSets = [
        'envelope list --output json --page-size 20',
        'envelope list --output json',
      ]
      let listErr: unknown
      for (const args of listArgSets) {
        try {
          raw = runHimalaya(args)
          break
        } catch (err) {
          listErr = err
        }
      }

      if (!raw) throw listErr

      // If output isn't JSON (e.g. table format), mark available but empty
      try {
        emails = parseHimalayaEmails(raw)
      } catch {
        emails = []
      }

      // Enrich the first 10 emails with body preview + attachment metadata.
      // fetchEmailDetails is synchronous (execSync); run sequentially.
      const ENRICH_LIMIT = 10
      for (let i = 0; i < Math.min(emails.length, ENRICH_LIMIT); i++) {
        const email = emails[i]
        try {
          const details = fetchEmailDetails(email.id)
          if (i === 0) {
            console.log('[email-debug] fetchEmailDetails result for id', email.id, JSON.stringify({
              previewLen: details.preview.length,
              previewSnippet: details.preview.slice(0, 80),
              attachments: details.attachments,
            }))
          }
          emails[i] = {
            ...email,
            preview: details.preview || email.subject,
            attachments: details.attachments.length > 0 ? details.attachments : email.attachments,
          }
        } catch (err) {
          emails[i] = { ...email, preview: email.subject }
          console.warn('[email-debug] fetchEmailDetails failed for id', email.id, err)
        }
      }
      // Emails beyond ENRICH_LIMIT: use subject as preview fallback
      for (let i = ENRICH_LIMIT; i < emails.length; i++) {
        if (!emails[i].preview) emails[i] = { ...emails[i], preview: emails[i].subject }
      }

      himalayaAvailable = true
      totalCount = emails.length
    } catch (err) {
      himalayaError = err instanceof Error ? err.message : String(err)
      himalayaAvailable = false
    }

    const unreadCount = emails.filter(e => !e.isRead).length

    return NextResponse.json({
      cron: emailCron ?? null,
      emails,
      unreadCount,
      totalCount,
      himalayaAvailable,
      himalayaError,
      account: 'agent@tbs-marketing.com',
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load email data')
  }
}
