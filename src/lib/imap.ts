/**
 * Shared IMAP client helper using imapflow.
 * Replaces all himalaya CLI calls with a direct Node.js IMAP connection.
 *
 * Required env vars:
 *   EMAIL_IMAP_HOST    e.g. "imappro.zoho.com"
 *   EMAIL_IMAP_PORT    e.g. "993"
 *   EMAIL_ADDRESS      e.g. "agent@tbs-marketing.com"
 *   EMAIL_PASSWORD     Zoho password / app-specific password
 *   EMAIL_SMTP_HOST    e.g. "smtppro.zoho.com"
 *   EMAIL_SMTP_PORT    e.g. "465"
 */

import { ImapFlow } from 'imapflow'
import type { MessageEnvelopeObject, MessageStructureObject } from 'imapflow'
import nodemailer from 'nodemailer'
import { simpleParser } from 'mailparser'

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

function requireEmailEnv() {
  const host = process.env.EMAIL_IMAP_HOST
  const port = parseInt(process.env.EMAIL_IMAP_PORT ?? '993', 10)
  const user = process.env.EMAIL_ADDRESS
  const pass = process.env.EMAIL_PASSWORD

  if (!host || !user || !pass) {
    throw new Error(
      'Missing email credentials. Set EMAIL_IMAP_HOST, EMAIL_ADDRESS, EMAIL_PASSWORD in .env.local'
    )
  }
  return { host, port, user, pass }
}

/**
 * Create an imapflow client (not yet connected).
 * Always call client.logout() when done — use withImap() for safety.
 */
export function createImapClient(): ImapFlow {
  const { host, port, user, pass } = requireEmailEnv()
  return new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user, pass },
    logger: false, // suppress noisy IMAP protocol logs
  })
}

/**
 * Run a callback with a connected IMAP client, then cleanly log out.
 */
export async function withImap<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = createImapClient()
  await client.connect()
  try {
    return await fn(client)
  } finally {
    try { await client.logout() } catch { /* best-effort */ }
  }
}

function parseAddress(env: MessageEnvelopeObject['from']): { addr: string; name: string } {
  const first = Array.isArray(env) ? env[0] : env
  if (!first) return { addr: '', name: '' }
  const addr = first.address ?? ''
  const name = first.name ?? addr.split('@')[0] ?? ''
  return { addr, name }
}

/**
 * List emails from INBOX with body previews and attachment metadata.
 * Returns up to `limit` messages, newest first.
 */
export async function listEmails(limit = 20): Promise<EmailMessage[]> {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock('INBOX')
    const messages: EmailMessage[] = []

    try {
      const mailbox = client.mailbox
      const total = mailbox && typeof mailbox === 'object' && 'exists' in mailbox
        ? (mailbox as { exists: number }).exists
        : 0

      if (total === 0) return []

      const start = Math.max(1, total - limit + 1)
      const range = `${start}:*`

      for await (const msg of client.fetch(range, {
        envelope: true,
        flags: true,
        bodyStructure: true,
        bodyParts: ['TEXT'],
        size: true,
      })) {
        const envelope = msg.envelope
        if (!envelope) continue

        const { addr, name } = parseAddress(envelope.from)
        const flags = [...(msg.flags ?? [])]
        const isRead = flags.includes('\\Seen')

        // Body preview from TEXT part
        let preview = ''
        const textPart = msg.bodyParts?.get('TEXT')
        if (textPart) {
          preview = textPart.toString('utf-8').replace(/\r\n/g, '\n').slice(0, 300).trim()
        }

        // Attachments from body structure
        const attachments = msg.bodyStructure ? extractAttachments(msg.bodyStructure) : []

        messages.push({
          id: String(msg.uid),
          subject: envelope.subject ?? '(No subject)',
          from: addr,
          fromName: name || addr.split('@')[0] || 'Unknown',
          date: (envelope.date ?? new Date()).toISOString(),
          flags,
          isRead,
          isProcessed: false,
          preview: preview || envelope.subject || '',
          attachments,
        })
      }
    } finally {
      lock.release()
    }

    // Return newest first
    return messages.reverse()
  })
}

/**
 * Fetch a single email's full body text by UID.
 */
export async function fetchEmailBody(uid: string): Promise<string> {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock('INBOX')
    try {
      const download = await client.download(uid, undefined, { uid: true })
      if (!download) return ''
      const parsed = await simpleParser(download.content)
      return (parsed.text ?? '').slice(0, 3000)
    } finally {
      lock.release()
    }
  })
}

/**
 * Mark a message as Seen by UID.
 */
export async function markAsRead(uid: string): Promise<void> {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock('INBOX')
    try {
      await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true })
    } finally {
      lock.release()
    }
  })
}

/**
 * Delete (expunge) a message by UID.
 */
export async function deleteEmail(uid: string): Promise<void> {
  return withImap(async (client) => {
    const lock = await client.getMailboxLock('INBOX')
    try {
      await client.messageDelete(uid, { uid: true })
    } finally {
      lock.release()
    }
  })
}

/**
 * Send an email via SMTP using nodemailer.
 */
export async function sendEmail(opts: {
  to: string
  subject: string
  text: string
}): Promise<void> {
  const smtpHost = process.env.EMAIL_SMTP_HOST
  const smtpPort = parseInt(process.env.EMAIL_SMTP_PORT ?? '465', 10)
  const user = process.env.EMAIL_ADDRESS
  const pass = process.env.EMAIL_PASSWORD

  if (!smtpHost || !user || !pass) {
    throw new Error('Missing SMTP credentials. Set EMAIL_SMTP_HOST, EMAIL_ADDRESS, EMAIL_PASSWORD.')
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from: `TBS Marketing Agent <${user}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  })
}

/**
 * Test IMAP connectivity — returns true if login succeeds.
 */
export async function testImapConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await withImap(async () => {
      // Connecting and logging out verifies credentials
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Internals ────────────────────────────────────────────────────────────────

function extractAttachments(struct: MessageStructureObject): EmailAttachment[] {
  const results: EmailAttachment[] = []

  function walk(node: MessageStructureObject): void {
    const disposition = node.disposition ?? ''
    const type = node.type ?? ''
    const params = node.parameters ?? {}
    const name: string = (params as Record<string, string>)['name']
      ?? (params as Record<string, string>)['filename']
      ?? ''
    const size = node.size ?? 0

    if (
      name &&
      (disposition === 'attachment' || (!type.startsWith('text/') && !type.startsWith('multipart/')))
    ) {
      results.push({ name, mime: type || 'application/octet-stream', size })
    }

    const children = node.childNodes ?? []
    for (const child of children) walk(child)
  }

  walk(struct)
  return results
}
