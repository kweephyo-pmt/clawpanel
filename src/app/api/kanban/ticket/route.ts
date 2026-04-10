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

    // Deduplication check for email tickets:
    // Email tickets prefix the title with "📧" and include From/Received in description.
    // If a ticket with the exact same Subject + Sender + Received Date exists, do not recreate.
    const incomingFromMatch = (body.description ?? '').match(/^From:\s*(.+)$/m);
    const incomingReceivedMatch = (body.description ?? '').match(/^Received:\s*(.+)$/m);
    
    // Only apply strict deduplication if this looks like an email ticket
    const existingTicket = body.title?.startsWith('📧') ? Object.values(store).find(t => {
      if (t.title !== body.title.trim()) return false;
      
      const existingFromMatch = t.description.match(/^From:\s*(.+)$/m);
      const existingReceivedMatch = t.description.match(/^Received:\s*(.+)$/m);
      
      if (incomingFromMatch && existingFromMatch) {
        // Normalize From by removing <email> or (email) and trailing spaces to prevent trivial mismatches
        const cleanFrom = (s: string) => s.replace(/<[^>]+>|\([^)]+\)/g, '').trim().toLowerCase();
        const from1 = cleanFrom(existingFromMatch[1]);
        const from2 = cleanFrom(incomingFromMatch[1]);
        
        // Ensure at least someone matched some identity portion
        const isFromMatch = from1 && from2 && (from1.includes(from2) || from2.includes(from1));

        if (isFromMatch) {
          // If both have Received, ensure the dates match down to the minute or entirely 
          // (removes seconds and timezone variances that sometimes shift during fetch)
          if (incomingReceivedMatch && existingReceivedMatch) {
            const date1 = existingReceivedMatch[1].trim().replace(/:\d{2}(\+.*|Z)?$/, '');
            const date2 = incomingReceivedMatch[1].trim().replace(/:\d{2}(\+.*|Z)?$/, '');
            return date1 === date2;
          }
          return true; // Match Subject + From if missing received
        }
      }
      return false; // Safest fallback
    }) : undefined;

    if (existingTicket) {
      console.log(`[kanban/ticket] Deduplication prevented duplicate ticket creation for ${existingTicket.id}`);
      return NextResponse.json({ 
        ok: true, 
        id: existingTicket.id, 
        title: existingTicket.title,
        duplicate: true 
      })
    }

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
