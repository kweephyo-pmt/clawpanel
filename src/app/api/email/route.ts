import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getCrons } from '@/lib/crons'
import { listEmails, testImapConnection } from '@/lib/imap'

export const dynamic = 'force-dynamic'

export type { EmailAttachment, EmailMessage } from '@/lib/imap'

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

    // Check if email credentials are configured
    const hasCredentials =
      !!process.env.EMAIL_IMAP_HOST &&
      !!process.env.EMAIL_ADDRESS &&
      !!process.env.EMAIL_PASSWORD

    if (!hasCredentials) {
      return NextResponse.json({
        cron: emailCron ?? null,
        emails: [],
        unreadCount: 0,
        totalCount: 0,
        himalayaAvailable: false,
        himalayaError: 'Email credentials not configured. Set EMAIL_IMAP_HOST, EMAIL_ADDRESS, EMAIL_PASSWORD in .env.local',
        account: process.env.EMAIL_ADDRESS ?? 'not configured',
        fetchedAt: new Date().toISOString(),
      })
    }

    // Test connectivity first (fast)
    const { ok, error: connError } = await testImapConnection()
    if (!ok) {
      return NextResponse.json({
        cron: emailCron ?? null,
        emails: [],
        unreadCount: 0,
        totalCount: 0,
        himalayaAvailable: false,
        himalayaError: connError ?? 'IMAP connection failed',
        account: process.env.EMAIL_ADDRESS ?? '',
        fetchedAt: new Date().toISOString(),
      })
    }

    // Fetch emails with previews
    const emails = await listEmails(20)
    const unreadCount = emails.filter(e => !e.isRead).length

    return NextResponse.json({
      cron: emailCron ?? null,
      emails,
      unreadCount,
      totalCount: emails.length,
      himalayaAvailable: true,
      himalayaError: null,
      account: process.env.EMAIL_ADDRESS ?? '',
      fetchedAt: new Date().toISOString(),
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load email data')
  }
}
