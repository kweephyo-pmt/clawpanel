import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'
import { getCrons } from '@/lib/crons'

export const dynamic = 'force-dynamic'

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
}

function runHimalaya(args: string, account = 'agent@tbs-marketing.com'): string {
  return execSync(`himalaya --account "${account}" ${args}`, {
    encoding: 'utf-8',
    timeout: 15000,
  })
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

      return {
        id,
        subject,
        from: fromStr,
        fromName: fromName || fromStr.split('@')[0] || 'Unknown',
        date,
        flags,
        isRead,
        isProcessed: false,
        preview: subject,
      }
    })
  } catch {
    return []
  }
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
      // Check if himalaya is available
      execSync('himalaya --version', { encoding: 'utf-8', timeout: 5000 })
      himalayaAvailable = true

      // Fetch inbox listing (latest 20)
      const raw = runHimalaya('list --max-width 0 --output json --page-size 20')
      emails = parseHimalayaEmails(raw)
      totalCount = emails.length

      // Try to get total count separately
      try {
        const countRaw = runHimalaya('list --max-width 0 --output json')
        const countParsed = JSON.parse(countRaw)
        const countArr = Array.isArray(countParsed)
          ? countParsed
          : countParsed.response ?? countParsed.data ?? []
        totalCount = countArr.length
      } catch { /* ignore */ }
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
