/**
 * GET /api/email
 *
 * Returns the email agent's cron status + email-triggered kanban projects.
 * No IMAP/SMTP — email processing is handled entirely by OpenClaw (himalaya skill).
 */

import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/api-error'
import { getCrons } from '@/lib/crons'
import { serverLoadTickets } from '@/lib/kanban/server-store'
import type { KanbanTicket } from '@/lib/kanban/types'
import type { CronJob } from '@/lib/types'

export const dynamic = 'force-dynamic'

export interface EmailProject {
  id: string
  title: string
  subject: string       // stripped from ticket title (removes 📧 prefix)
  description: string
  status: KanbanTicket['status']
  priority: KanbanTicket['priority']
  workState: KanbanTicket['workState']
  createdAt: number
  updatedAt: number
  subTaskCount: number
}

export interface EmailPageData {
  cron: CronJob | null
  recentCrons: CronJob[]
  projects: EmailProject[]
  totalProjects: number
  activeProjects: number
  completedProjects: number
}

export async function GET() {
  try {
    // 1. Find the email cron job (looks for "email", "himalaya", or "inbox" in name)
    const allCrons = await getCrons().catch(() => [] as CronJob[])
    const emailCron = allCrons.find(c => {
      const n = c.name.toLowerCase()
      return n.includes('email') || n.includes('himalaya') || n.includes('inbox') || n.includes('mail')
    }) ?? null

    // 2. Load kanban tickets and filter email-triggered projects (📧 prefix)
    const store = serverLoadTickets()
    const allTickets = Object.values(store)

    const emailTickets = allTickets.filter(t => t.title.startsWith('📧'))
    const otherTickets = allTickets.filter(t => !t.title.startsWith('📧'))

    const projects: EmailProject[] = emailTickets
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20)
      .map(ticket => {
        const subject = ticket.title.replace(/^📧\s*/, '').trim()
        // Count sub-tasks: tickets whose descriptions reference this ticket's subject
        const subTaskCount = otherTickets.filter(
          t => t.description.includes(subject) || t.description.includes(ticket.id)
        ).length

        return {
          id: ticket.id,
          title: ticket.title,
          subject,
          description: ticket.description,
          status: ticket.status,
          priority: ticket.priority,
          workState: ticket.workState,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
          subTaskCount,
        }
      })

    const activeProjects = projects.filter(
      p => p.status === 'in-progress' || p.status === 'todo'
    ).length
    const completedProjects = projects.filter(p => p.status === 'done').length

    return NextResponse.json({
      cron: emailCron,
      recentCrons: allCrons.slice(0, 5),
      projects,
      totalProjects: emailTickets.length,
      activeProjects,
      completedProjects,
    } satisfies EmailPageData)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load email dashboard data')
  }
}
