'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Clock, Play, Power, Copy, Trash2, RefreshCw, Edit,
  CheckCircle2, XCircle, AlertTriangle, Timer, Loader2,
  Plus, X, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CronJob } from '@/lib/types'

// ─── Types ─────────────────────────────────────────────────────

export type ScheduleType = 'cron' | 'every' | 'at'

export interface NewJobForm {
  name: string
  scheduleType: ScheduleType
  schedule: string
  payloadType: 'message' | 'systemEvent'
  message: string
  systemEvent: string
  description: string
  agent: string
  tz: string
  enabled: boolean

  sessionTarget: 'main' | 'isolated' | ''
  sessionKey: string
  wake: 'now' | 'next-heartbeat' | ''
  timeoutSeconds: number | ''
  modelOverride: string
  thinking: string
  resultDelivery: 'announce' | 'internal' | ''
  deleteAfterRun: boolean
  clearAgentOverride: boolean
  exactTiming: boolean
  staggerWindow: string
  staggerUnit: 'Seconds' | 'Minutes'
  accountId: string
  lightContext: boolean
  failureAlerts: 'default' | 'enabled' | 'disabled'
}

export const EMPTY_FORM: NewJobForm = {
  name: '',
  scheduleType: 'cron',
  schedule: '',
  payloadType: 'message',
  message: '',
  systemEvent: '',
  description: '',
  agent: '',
  tz: '',
  enabled: true,

  sessionTarget: '',
  sessionKey: '',
  wake: '',
  timeoutSeconds: '',
  modelOverride: '',
  thinking: '',
  resultDelivery: '',
  deleteAfterRun: false,
  clearAgentOverride: false,
  exactTiming: false,
  staggerWindow: '',
  staggerUnit: 'Seconds',
  accountId: '',
  lightContext: false,
  failureAlerts: 'default',
}

type ActionState = { id: string; action: string } | null



// ─── API helpers ────────────────────────────────────────────────

async function fetchCrons(): Promise<CronJob[]> {
  const res = await fetch('/api/crons')
  if (!res.ok) throw new Error('Failed to fetch crons')
  const data = await res.json()
  return Array.isArray(data) ? data : (data.crons ?? [])
}

async function cronAction(cronId: string, action: string) {
  const res = await fetch('/api/crons/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, cronId }),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || 'Action failed')
  return data
}

async function cronAdd(form: NewJobForm) {
  const body: Record<string, unknown> = {
    ...form,
    timeoutSeconds: form.timeoutSeconds ? Number(form.timeoutSeconds) : undefined
  }
  if (form.payloadType === 'message') {
    body.message = form.message
  } else {
    body.systemEvent = form.systemEvent
  }
  const res = await fetch('/api/crons/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to create cron job')
  return data
}

async function cronEdit(id: string, form: NewJobForm) {
  const body: Record<string, unknown> = {
    ...form,
    id,
    timeoutSeconds: form.timeoutSeconds ? Number(form.timeoutSeconds) : undefined
  }
  if (form.payloadType === 'message') {
    body.message = form.message
  } else {
    body.systemEvent = form.systemEvent
  }
  const res = await fetch('/api/crons/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to update cron job')
  return data
}

// ─── Helpers ─────────────────────────────────────────────────

/** Guess the schedule type from a raw schedule string */
function guessScheduleType(schedule: string): ScheduleType {
  if (!schedule) return 'cron'
  const s = schedule.trim()
  // ISO or +duration → at
  if (s.startsWith('+') || /^\d{4}-\d{2}-\d{2}/.test(s)) return 'at'
  // e.g. "10m", "1h", "1d" → every
  if (/^\d+[smhd]$/.test(s)) return 'every'
  return 'cron'
}

function StatusBadge({ cron }: { cron: CronJob }) {
  if (!cron.enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
        <Power className="w-3 h-3" /> Disabled
      </span>
    )
  }
  if (cron.status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle className="w-3 h-3" /> Error
      </span>
    )
  }
  if (cron.status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
        <CheckCircle2 className="w-3 h-3" /> OK
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
      <Clock className="w-3 h-3" /> Idle
    </span>
  )
}

function formatNextRun(isoString: string | null): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  const diffMs = d.getTime() - Date.now()
  if (diffMs < 0) return 'Overdue'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatLastRun(isoString: string | null): string {
  if (!isoString) return 'Never'
  const d = new Date(isoString)
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── New Job Modal ─────────────────────────────────────────────

interface NewJobModalProps {
  initialForm?: Partial<NewJobForm>
  editId?: string
  onClose: () => void
  onCreated: () => void
  showToast: (msg: string, type: 'ok' | 'error') => void
}

interface NewJobModalProps {
  initialForm?: Partial<NewJobForm>
  editId?: string
  onClose: () => void
  onCreated: () => void
  showToast: (msg: string, type: 'ok' | 'error') => void
}

function NewJobModal({ initialForm, editId, onClose, onCreated, showToast }: NewJobModalProps) {
  const [form, setForm] = useState<NewJobForm>({ ...EMPTY_FORM, ...initialForm })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Expandable sections toggle
  const [showAdvanced, setShowAdvanced] = useState(false)

  const overlayRef = useRef<HTMLDivElement>(null)

  const set = <K extends keyof NewJobForm>(key: K, value: NewJobForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (editId) {
        await cronEdit(editId, form)
        showToast(`Cron job "${form.name}" updated`, 'ok')
      } else {
        await cronAdd(form)
        showToast(`Cron job "${form.name}" created`, 'ok')
      }
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${editId ? 'update' : 'create'} cron job`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const inputCls = "w-full flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
  const labelCls = "block text-sm font-medium text-foreground mb-1"
  const selectCls = `${inputCls} appearance-none cursor-pointer`
  const helpCls = "text-xs text-muted-foreground mt-1"

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh] my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-xl font-bold">
               {editId ? 'Edit Job' : 'New Job'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
               {editId ? 'Update an existing job.' : 'Create a scheduled wakeup or agent run.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors -mt-4 -mr-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6 bg-zinc-50/50 dark:bg-zinc-950/20">
            <p className="text-sm text-muted-foreground -mt-2"><span className="text-red-400">*</span> Required</p>
            
            {/* --- Section 1: Basics --- */}
            <div className="bg-background rounded-xl border border-border p-5 space-y-4 shadow-sm">
                <h4 className="font-semibold text-base mb-3">Basics</h4>
                <p className="text-sm text-muted-foreground -mt-2 mb-4">Name it, choose the assistant, and set enabled state.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Name <span className="text-red-400">*</span></label>
                    <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} required autoFocus />
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <input className={inputCls} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-4 pt-2">
                   <div className="w-full md:flex-1">
                     <label className={labelCls}>Agent ID</label>
                     <input className={inputCls} value={form.agent} onChange={e => set('agent', e.target.value)} placeholder="e.g. main" />
                     <p className={helpCls}>Start typing to pick a known agent, or enter a custom one.</p>
                   </div>
                   
                   <div className="w-full md:w-auto md:shrink-0 flex items-center md:pt-4">
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                        <span className="text-sm font-medium">Enabled</span>
                     </label>
                   </div>
                </div>
            </div>
            
            {/* --- Section 2: Schedule --- */}
            <div className="bg-background rounded-xl border border-border p-5 space-y-4 shadow-sm">
                 <h4 className="font-semibold text-base mb-3">Schedule</h4>
                 <p className="text-sm text-muted-foreground -mt-2 mb-4">Control when this job runs.</p>
                 
                 <div className="grid grid-cols-1 gap-4">
                     <div>
                       <label className={labelCls}>Schedule type</label>
                       <div className="relative">
                          <select className={selectCls} value={form.scheduleType} onChange={e => set('scheduleType', e.target.value as ScheduleType)}>
                            <option value="cron">Cron</option>
                            <option value="every">Every</option>
                            <option value="at">At</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                       </div>
                     </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                   <div>
                      <label className={labelCls}>Expression <span className="text-red-400">*</span></label>
                      <input className={inputCls} placeholder={form.scheduleType === 'cron' ? '*/5 * * * *' : form.scheduleType === 'every' ? '1h' : '2026-05-01T09:00:00Z'} value={form.schedule} onChange={e => set('schedule', e.target.value)} required />
                   </div>
                   {form.scheduleType === 'cron' && (
                     <div>
                        <label className={labelCls}>Timezone <span className="text-muted-foreground font-normal">(optional)</span></label>
                        <input className={inputCls} placeholder="Asia/Bangkok" value={form.tz} onChange={e => set('tz', e.target.value)} />
                        <p className={helpCls}>Any valid IANA timezone.</p>
                     </div>
                   )}
                 </div>
                 <p className={helpCls}>Need jitter? Use Advanced → Stagger window.</p>
            </div>
            
            {/* --- Section 3: Execution --- */}
            <div className="bg-background rounded-xl border border-border p-5 space-y-4 shadow-sm">
               <h4 className="font-semibold text-base mb-3">Execution</h4>
               <p className="text-sm text-muted-foreground -mt-2 mb-4">Choose when to wake, and what this job should do.</p>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className={labelCls}>Session</label>
                    <div className="relative">
                       <select className={selectCls} value={form.sessionTarget} onChange={e => set('sessionTarget', e.target.value as any)}>
                         <option value="">Default</option>
                         <option value="isolated">Isolated</option>
                         <option value="main">Main</option>
                       </select>
                       <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <p className={helpCls}>Isolated runs a dedicated turn.</p>
                 </div>
                 <div>
                    <label className={labelCls}>Wake mode</label>
                    <div className="relative">
                       <select className={selectCls} value={form.wake} onChange={e => set('wake', e.target.value as any)}>
                         <option value="">Default (now)</option>
                         <option value="now">Now</option>
                         <option value="next-heartbeat">Next heartbeat</option>
                       </select>
                       <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <p className={helpCls}>Trigger immediately or wait.</p>
                 </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                 <div>
                   <label className={labelCls}>What should run?</label>
                   <div className="relative">
                       <select className={selectCls} value={form.payloadType} onChange={e => set('payloadType', e.target.value as any)}>
                         <option value="message">Run assistant task</option>
                         <option value="systemEvent">System event</option>
                       </select>
                       <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                 </div>
                 <div>
                   <label className={labelCls}>Timeout (seconds)</label>
                   <input type="number" className={inputCls} placeholder="Optional, e.g. 90" value={form.timeoutSeconds} onChange={e => set('timeoutSeconds', e.target.value ? Number(e.target.value) : '')} />
                   <p className={helpCls}>Leave blank to use default timeout.</p>
                 </div>
               </div>
               
               <div className="pt-2">
                 <label className={labelCls}>{form.payloadType === 'message' ? 'Assistant task prompt' : 'System event'} <span className="text-red-400">*</span></label>
                 {form.payloadType === 'message' ? (
                     <textarea
                       className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[160px] resize-y font-mono whitespace-pre-wrap leading-relaxed"
                       value={form.message}
                       onChange={e => set('message', e.target.value)}
                       required
                     />
                 ) : (
                     <input className={inputCls} value={form.systemEvent} onChange={e => set('systemEvent', e.target.value)} required />
                 )}
               </div>
            </div>
            
            {/* --- Section 4: Delivery --- */}
            <div className="bg-background rounded-xl border border-border p-5 space-y-4 shadow-sm">
                <h4 className="font-semibold text-base mb-3">Delivery</h4>
                <p className="text-sm text-muted-foreground -mt-2 mb-4">Choose where run summaries are sent.</p>
                <div>
                   <label className={labelCls}>Result delivery</label>
                   <div className="relative">
                       <select className={selectCls} value={form.resultDelivery} onChange={e => set('resultDelivery', e.target.value as any)}>
                         <option value="">Default (announce)</option>
                         <option value="internal">None (internal)</option>
                         <option value="announce">Announce to chat</option>
                       </select>
                       <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    </div>
                    <p className={helpCls}>Announce posts a summary. None keeps execution internal.</p>
                </div>
            </div>
            
            {/* --- Section 5: Advanced --- */}
            <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
               <button 
                  type="button" 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full px-5 py-4 flex items-center gap-2 font-semibold text-base hover:bg-muted/50 transition-colors"
               >
                 <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                 Advanced
               </button>
               
               {showAdvanced && (
                 <div className="px-5 pb-5 pt-1 space-y-6 border-t border-border">
                    <p className="text-sm text-muted-foreground -mt-2 mb-4">Optional overrides for delivery guarantees, schedule jitter, and model controls.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <label className="flex items-start gap-3 cursor-pointer group">
                          <input type="checkbox" checked={form.deleteAfterRun} onChange={e => set('deleteAfterRun', e.target.checked)} className="w-4 h-4 mt-0.5 rounded accent-primary" />
                          <div>
                            <span className="text-sm font-medium group-hover:text-primary transition-colors">Delete after run</span>
                            <p className="text-xs text-muted-foreground mt-0.5">Best for one-shot reminders that should auto-clean up.</p>
                          </div>
                       </label>
                       
                       <label className="flex items-start gap-3 cursor-pointer group">
                          <input type="checkbox" checked={form.clearAgentOverride} onChange={e => set('clearAgentOverride', e.target.checked)} className="w-4 h-4 mt-0.5 rounded accent-primary" />
                          <div>
                            <span className="text-sm font-medium group-hover:text-primary transition-colors">Clear agent override</span>
                            <p className="text-xs text-muted-foreground mt-0.5">Force this job to use the gateway default assistant.</p>
                          </div>
                       </label>
                    </div>
                    
                    <div>
                       <label className={labelCls}>Session key</label>
                       <input className={inputCls} placeholder="e.g. agent:main:main" value={form.sessionKey} onChange={e => set('sessionKey', e.target.value)} />
                       <p className={helpCls}>Optional routing key for job delivery and wake routing.</p>
                    </div>
                    
                    <div className="space-y-4">
                       <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" checked={form.exactTiming} onChange={e => set('exactTiming', e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                          <span className="text-sm font-medium group-hover:text-primary transition-colors">Exact timing (no stagger)</span>
                       </label>
                       
                       <div className="grid grid-cols-2 gap-4">
                         <div>
                           <label className={labelCls}>Stagger window</label>
                           <input type="number" className={inputCls} disabled={form.exactTiming} value={form.staggerWindow} onChange={e => set('staggerWindow', e.target.value)} />
                         </div>
                         <div>
                           <label className={labelCls}>Stagger unit</label>
                           <div className="relative">
                             <select className={selectCls} disabled={form.exactTiming} value={form.staggerUnit} onChange={e => set('staggerUnit', e.target.value as any)}>
                               <option value="Seconds">Seconds</option>
                               <option value="Minutes">Minutes</option>
                             </select>
                             <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                           </div>
                         </div>
                       </div>
                    </div>
                    
                    <div>
                       <label className={labelCls}>Account ID</label>
                       <input className={inputCls} placeholder="default" value={form.accountId} onChange={e => set('accountId', e.target.value)} />
                    </div>
                    
                    <div>
                       <label className="flex items-center gap-3 cursor-pointer group mb-4">
                          <input type="checkbox" checked={form.lightContext} onChange={e => set('lightContext', e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                          <span className="text-sm font-medium group-hover:text-primary transition-colors">Light context</span>
                       </label>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className={labelCls}>Model</label>
                           <input className={inputCls} placeholder="openai/gpt-5.2" value={form.modelOverride} onChange={e => set('modelOverride', e.target.value)} />
                        </div>
                        <div>
                           <label className={labelCls}>Thinking</label>
                           <input className={inputCls} placeholder="low" value={form.thinking} onChange={e => set('thinking', e.target.value)} />
                        </div>
                    </div>
                    
                    <div>
                       <label className={labelCls}>Failure alerts</label>
                       <div className="relative">
                          <select className={selectCls} value={form.failureAlerts} onChange={e => set('failureAlerts', e.target.value as any)}>
                             <option value="default">Inherit global setting</option>
                             <option value="enabled">Enabled</option>
                             <option value="disabled">Disabled</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                       </div>
                    </div>

                 </div>
               )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            {/* Scroll buffer */}
            <div className="h-4" />
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border shrink-0 bg-card rounded-b-xl">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : ''}
            {editId ? 'Save changes' : 'Add job'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────

export default function CronsPage() {
  const [crons, setCrons] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionState, setActionState] = useState<ActionState>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'error' } | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all')

  // Modal state: null = closed, {} = new, { ...prefill } = clone/edit
  const [modal, setModal] = useState<{ form: Partial<NewJobForm>, editId?: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCrons()
      setCrons(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load crons')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string, type: 'ok' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const doAction = async (cronId: string, action: string, label: string) => {
    setActionState({ id: cronId, action })
    try {
      await cronAction(cronId, action)
      showToast(`${label} successful`, 'ok')
      await load()
    } catch (e) {
      showToast(e instanceof Error ? e.message : `${label} failed`, 'error')
    } finally {
      setActionState(null)
    }
  }

  const isBusy = (cronId: string, action?: string) =>
    actionState?.id === cronId && (!action || actionState.action === action)

  /** Open the modal pre-filled with a clone of the given cron */
  const openClone = (cron: CronJob) => {
    const scheduleType = guessScheduleType(cron.schedule)
    const isSystemEvent = !!cron.payloadSystemEvent
    const prefill: Partial<NewJobForm> = {
      name: `${cron.name}-copy`,
      scheduleType,
      schedule: cron.schedule,
      tz: cron.timezone ?? '',
      description: cron.description ?? '',
      agent: cron.agentId ?? '',
      enabled: cron.enabled,
      payloadType: isSystemEvent ? 'systemEvent' : 'message',
      message: cron.payloadMessage ?? '',
      systemEvent: cron.payloadSystemEvent ?? '',
    }
    setModal({ form: prefill })
  }

  /** Open the modal to edit an existing cron */
  const openEdit = (cron: CronJob) => {
    const scheduleType = guessScheduleType(cron.schedule)
    const isSystemEvent = !!cron.payloadSystemEvent
    const prefill: Partial<NewJobForm> = {
      name: cron.name,
      scheduleType,
      schedule: cron.schedule,
      tz: cron.timezone ?? '',
      description: cron.description ?? '',
      agent: cron.agentId ?? '',
      enabled: cron.enabled,
      payloadType: isSystemEvent ? 'systemEvent' : 'message',
      message: cron.payloadMessage ?? '',
      systemEvent: cron.payloadSystemEvent ?? '',
    }
    setModal({ form: prefill, editId: cron.id })
  }

  const filtered = crons
    .filter(c => filter === 'all' ? true : filter === 'enabled' ? c.enabled : !c.enabled)
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 pt-6 gap-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl border text-sm font-medium transition-all
          ${toast.type === 'ok' ? 'bg-green-950 border-green-500/30 text-green-300' : 'bg-red-950 border-red-500/30 text-red-300'}`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cron Jobs</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {crons.length} job{crons.length !== 1 ? 's' : ''} · {crons.filter(c => c.enabled).length} enabled
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={load} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button size="sm" onClick={() => setModal({ form: {} })}>
            <Plus className="w-4 h-4 mr-2" />
            New job
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring flex-1"
          placeholder="Search crons…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1 p-1 bg-muted rounded-md">
          {(['all', 'enabled', 'disabled'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded capitalize transition-colors
                ${filter === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr className="text-xs uppercase text-muted-foreground font-medium">
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Schedule</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Last Run</th>
                <th className="px-5 py-3 text-left">Next Run</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && crons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading cron jobs…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted-foreground">
                    <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    {search || filter !== 'all' ? 'No crons match your filters.' : 'No cron jobs found.'}
                  </td>
                </tr>
              ) : filtered.map(cron => (
                <tr key={cron.id} className={`hover:bg-muted/20 transition-colors ${isBusy(cron.id) ? 'opacity-60' : ''}`}>
                  {/* Name */}
                  <td className="px-5 py-4 max-w-[220px]">
                    <TooltipProvider delayDuration={300}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium truncate cursor-default">{cron.name}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs break-all">
                            {cron.name}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {cron.agentId && (
                        <div className="text-xs text-muted-foreground mt-0.5 ml-5 truncate">{cron.agentId}</div>
                      )}
                      {cron.lastError && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-xs text-red-400 mt-0.5 ml-5 truncate cursor-default">
                              ⚠ {cron.lastError}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs break-all text-red-300">
                            {cron.lastError}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TooltipProvider>
                  </td>

                  {/* Schedule */}
                  <td className="px-5 py-4">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-sm font-medium cursor-default">
                            {cron.scheduleDescription || cron.schedule}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span className="font-mono text-xs">{cron.schedule}</span>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    <StatusBadge cron={cron} />
                  </td>

                  {/* Last Run */}
                  <td className="px-5 py-4 text-muted-foreground text-xs">
                    <div>{formatLastRun(cron.lastRun)}</div>
                    {cron.lastDurationMs != null && (
                      <div className="flex items-center gap-1 mt-0.5 text-muted-foreground/60">
                        <Timer className="w-3 h-3" />
                        {cron.lastDurationMs < 1000
                          ? `${cron.lastDurationMs}ms`
                          : `${(cron.lastDurationMs / 1000).toFixed(1)}s`}
                      </div>
                    )}
                  </td>

                  {/* Next Run */}
                  <td className="px-5 py-4 text-xs">
                    <span className={cron.enabled && cron.nextRun ? 'text-foreground' : 'text-muted-foreground'}>
                      {cron.enabled ? formatNextRun(cron.nextRun) : '—'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <TooltipProvider delayDuration={300}>
                      <div className="flex items-center justify-end gap-1.5">

                        {/* Run Now */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              disabled={!!actionState}
                              onClick={() => doAction(cron.id, 'run', 'Run')}
                              className="p-1.5 rounded-md hover:bg-green-500/10 hover:text-green-500 text-muted-foreground transition-colors disabled:opacity-40"
                            >
                              {isBusy(cron.id, 'run') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Run now (force)</TooltipContent>
                        </Tooltip>

                        {/* Run if Due */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              disabled={!!actionState}
                              onClick={() => doAction(cron.id, 'run-due', 'Run if due')}
                              className="p-1.5 rounded-md hover:bg-blue-500/10 hover:text-blue-500 text-muted-foreground transition-colors disabled:opacity-40"
                            >
                              {isBusy(cron.id, 'run-due') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Timer className="w-4 h-4" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Run if due</TooltipContent>
                        </Tooltip>

                        {/* Enable/Disable */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              disabled={!!actionState}
                              onClick={() => doAction(cron.id, cron.enabled ? 'disable' : 'enable',
                                cron.enabled ? 'Disable' : 'Enable')}
                              className={`p-1.5 rounded-md transition-colors disabled:opacity-40
                                ${cron.enabled
                                  ? 'hover:bg-yellow-500/10 hover:text-yellow-500 text-muted-foreground'
                                  : 'hover:bg-green-500/10 hover:text-green-500 text-muted-foreground'}`}
                            >
                              {isBusy(cron.id, 'enable') || isBusy(cron.id, 'disable')
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Power className="w-4 h-4" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">{cron.enabled ? 'Disable' : 'Enable'}</TooltipContent>
                        </Tooltip>

                        {/* Edit */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              disabled={!!actionState}
                              onClick={() => openEdit(cron)}
                              className="p-1.5 rounded-md hover:bg-blue-500/10 hover:text-blue-500 text-muted-foreground transition-colors disabled:opacity-40"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Edit</TooltipContent>
                        </Tooltip>

                        {/* Clone */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              disabled={!!actionState}
                              onClick={() => openClone(cron)}
                              className="p-1.5 rounded-md hover:bg-purple-500/10 hover:text-purple-400 text-muted-foreground transition-colors disabled:opacity-40"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Clone</TooltipContent>
                        </Tooltip>

                        {/* Remove */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              disabled={!!actionState}
                              onClick={() => {
                                if (confirm(`Remove cron "${cron.name}"? This cannot be undone.`)) {
                                  doAction(cron.id, 'remove', 'Remove')
                                }
                              }}
                              className="p-1.5 rounded-md hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-colors disabled:opacity-40"
                            >
                              {isBusy(cron.id, 'remove') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Remove</TooltipContent>
                        </Tooltip>

                      </div>
                    </TooltipProvider>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New/Clone/Edit Job Modal */}
      {modal !== null && (
        <NewJobModal
          initialForm={modal.form}
          editId={modal.editId}
          onClose={() => setModal(null)}
          onCreated={load}
          showToast={showToast}
        />
      )}
    </div>
  )
}
