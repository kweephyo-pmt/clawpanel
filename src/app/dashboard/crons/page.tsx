'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Clock, Play, Power, Copy, Trash2, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle, Timer, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { CronJob } from '@/lib/types'

type ActionState = { id: string; action: string } | null

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
  const now = Date.now()
  const diffMs = d.getTime() - now
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
  const now = Date.now()
  const diffMs = now - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function CronsPage() {
  const [crons, setCrons] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionState, setActionState] = useState<ActionState>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'error' } | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all')

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
        <Button onClick={load} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
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
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-medium truncate max-w-[180px]" title={cron.name}>{cron.name}</span>
                    </div>
                    {cron.agentId && (
                      <div className="text-xs text-muted-foreground mt-0.5 ml-5">{cron.agentId}</div>
                    )}
                    {cron.lastError && (
                      <div className="text-xs text-red-400 mt-0.5 ml-5 truncate max-w-[180px]" title={cron.lastError}>
                        ⚠ {cron.lastError}
                      </div>
                    )}
                  </td>

                  {/* Schedule */}
                  <td className="px-5 py-4">
                    <div className="font-mono text-xs bg-muted/50 px-2 py-1 rounded border inline-block">
                      {cron.schedule}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{cron.scheduleDescription}</div>
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

                        {/* Copy ID (clone helper) */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              disabled={!!actionState}
                              onClick={() => {
                                navigator.clipboard.writeText(cron.name)
                                showToast(`Copied "${cron.name}" — paste into a new cron to clone`, 'ok')
                              }}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors disabled:opacity-40"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Copy name</TooltipContent>
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
    </div>
  )
}
