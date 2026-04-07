/**
 * POST /api/kanban/ticket
 *
 * Creates a single ticket in the ClawPanel Kanban store.
 * Designed so the OpenClaw agent can create tickets via curl:
 *
 *   curl -X POST http://localhost:3000/api/kanban/ticket \
 *     -H "Content-Type: application/json" \
 *     -d '{"title":"📧 Your Task","description":"Details..."}'
 */

import { NextResponse } from 'next/server'
import {
  serverLoadTickets,
  serverSaveTickets,
  serverCreateTicket,
} from '@/lib/kanban/server-store'
import type { TicketPriority, TicketStatus } from '@/lib/kanban/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      title: string
      description?: string
      status?: TicketStatus
      priority?: TicketPriority
      assigneeId?: string
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const store = serverLoadTickets()
    const { store: updated, id } = serverCreateTicket(store, {
      title: body.title.trim(),
      description: body.description ?? '',
      status: body.status ?? 'todo',
      priority: body.priority ?? 'medium',
      assigneeId: body.assigneeId ?? null,
    })

    serverSaveTickets(updated)

    return NextResponse.json({ ok: true, id, title: body.title.trim() })
  } catch (err) {
    console.error('[kanban/ticket] Failed to create ticket:', err)
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
  }
}
