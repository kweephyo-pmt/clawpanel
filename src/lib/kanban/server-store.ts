/**
 * Server-side kanban store helpers.
 * Reads and writes ~/.openclaw/clawport-kanban/store.json directly.
 * Used by API routes (email processor, etc.) that run server-side.
 */

import fs from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import type { KanbanTicket, TicketStatus, TicketPriority, WorkState } from './types'

export type KanbanStore = Record<string, KanbanTicket>

function getStoreFilePath() {
  return path.join(homedir(), '.clawpanel', 'kanban.json')
}

function ensureDir() {
  const dir = path.dirname(getStoreFilePath())
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function serverLoadTickets(): KanbanStore {
  try {
    const p = getStoreFilePath()
    if (!fs.existsSync(p)) return {}
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as KanbanStore
  } catch {
    return {}
  }
}

export function serverSaveTickets(store: KanbanStore): void {
  ensureDir()
  fs.writeFileSync(getStoreFilePath(), JSON.stringify(store, null, 2))
}

export function serverCreateTicket(
  store: KanbanStore,
  ticket: {
    title: string
    description?: string
    status?: TicketStatus
    priority?: TicketPriority
    assigneeId?: string | null
    assigneeRole?: string | null
    workState?: WorkState
    workResult?: string | null
    workError?: string | null
  },
): { store: KanbanStore; id: string } {
  const id = randomUUID()
  const now = Date.now()
  const next: KanbanStore = {
    ...store,
    [id]: {
      id,
      title: ticket.title,
      description: ticket.description ?? '',
      status: ticket.status ?? 'todo',
      priority: ticket.priority ?? 'medium',
      assigneeId: ticket.assigneeId ?? null,
      assigneeRole: ticket.assigneeRole ?? null,
      workState: ticket.workState ?? 'idle',
      workStartedAt: null,
      workError: ticket.workError ?? null,
      workResult: ticket.workResult ?? null,
      createdAt: now,
      updatedAt: now,
    },
  }
  return { store: next, id }
}

export function serverUpdateTicket(
  store: KanbanStore,
  id: string,
  updates: Partial<Omit<KanbanTicket, 'id' | 'createdAt'>>,
): KanbanStore {
  const existing = store[id]
  if (!existing) return store
  return {
    ...store,
    [id]: { ...existing, ...updates, updatedAt: Date.now() },
  }
}
