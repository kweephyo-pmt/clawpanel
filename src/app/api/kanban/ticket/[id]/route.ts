/**
 * PATCH /api/kanban/ticket/[id]
 *
 * Update a single kanban ticket (status, workState, workResult, workError).
 * Called by the OpenClaw email-processor skill to track job progress.
 *
 *   curl -X PATCH http://localhost:3000/api/kanban/ticket/<id> \
 *     -H "Content-Type: application/json" \
 *     -d '{"status":"done","workState":"done","workResult":"Replied to sender."}'
 */

import { NextResponse } from 'next/server'
import {
  serverLoadTickets,
  serverSaveTickets,
  serverUpdateTicket,
} from '@/lib/kanban/server-store'
import type { TicketStatus, WorkState } from '@/lib/kanban/types'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing ticket id' }, { status: 400 })
    }

    const body = await req.json() as {
      status?: TicketStatus
      workState?: WorkState
      workResult?: string | null
      workError?: string | null
      description?: string
    }

    const store = serverLoadTickets()
    if (!store[id]) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const updates: Parameters<typeof serverUpdateTicket>[2] = {}
    if (body.status !== undefined) updates.status = body.status
    if (body.workState !== undefined) updates.workState = body.workState
    if (body.workResult !== undefined) updates.workResult = body.workResult
    if (body.workError !== undefined) updates.workError = body.workError
    if (body.description !== undefined) updates.description = body.description

    const updated = serverUpdateTicket(store, id, updates)
    serverSaveTickets(updated)

    return NextResponse.json({ ok: true, id, ticket: updated[id] })
  } catch (err) {
    console.error('[kanban/ticket/[id]] Failed to update ticket:', err)
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing ticket id' }, { status: 400 })
    }

    const store = serverLoadTickets()
    if (!store[id]) {
      // already gone or never existed
      return NextResponse.json({ ok: true, id })
    }

    const updated = { ...store }
    delete updated[id]
    serverSaveTickets(updated)

    return NextResponse.json({ ok: true, id })
  } catch (err) {
    console.error('[kanban/ticket/[id]] Failed to delete ticket:', err)
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 })
  }
}
