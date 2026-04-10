'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Bot, Search, X, RefreshCw, Edit, Eye,
  ChevronDown, ChevronRight, GitBranch, LayoutGrid,
  Cpu, Wrench, Users, ArrowRight, FileText,
  Loader2, Zap
} from 'lucide-react'
import type { AgentEntry } from '@/lib/agents-registry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type ViewMode = 'grid' | 'tree'

const TOOL_COLORS: Record<string, string> = {
  exec: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
  read: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/20',
  write: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
  edit: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
  web_search: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
  web_fetch: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
  message: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  sessions_spawn: 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/20',
  memory_search: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/20',
  tts: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20',
}

function toolColor(tool: string) {
  return TOOL_COLORS[tool] ?? 'bg-muted text-muted-foreground border-border'
}

// ---------------------------------------------------------------------------
// Agent Detail Slide-over Panel
// ---------------------------------------------------------------------------

function AgentDetailPanel({
  agent,
  allAgents,
  onClose,
}: {
  agent: AgentEntry
  allAgents: AgentEntry[]
  onClose: () => void
}) {
  const [view, setView] = useState<'info' | 'soul'>('info')
  const [soulContent, setSoulContent] = useState<string | null>(null)
  const [soulLoading, setSoulLoading] = useState(false)
  const [soulSaving, setSoulSaving] = useState(false)
  const [soulEditing, setSoulEditing] = useState(false)
  const [editBuf, setEditBuf] = useState('')
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saved' | 'error'>('idle')

  const parentAgent = agent.reportsTo
    ? allAgents.find(a => a.id === agent.reportsTo)
    : null

  const directReportAgents = allAgents.filter(a => agent.directReports.includes(a.id))

  const loadSoul = useCallback(async () => {
    if (soulContent !== null) return
    setSoulLoading(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}/soul`)
      if (res.ok) {
        const data = await res.json() as { content: string | null }
        setSoulContent(data.content ?? '')
      }
    } finally {
      setSoulLoading(false)
    }
  }, [agent.id, soulContent])

  const handleViewSoul = () => {
    setView('soul')
    loadSoul()
  }

  useEffect(() => {
    if (soulEditing && soulContent !== null && editBuf === '') {
      setEditBuf(soulContent)
    }
  }, [soulContent, soulEditing, editBuf])

  const handleSaveSoul = async () => {
    setSoulSaving(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}/soul`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editBuf }),
      })
      if (res.ok) {
        setSoulContent(editBuf)
        setSoulEditing(false)
        setSaveFeedback('saved')
        setTimeout(() => setSaveFeedback('idle'), 2500)
      } else {
        setSaveFeedback('error')
        setTimeout(() => setSaveFeedback('idle'), 3000)
      }
    } catch {
      setSaveFeedback('error')
      setTimeout(() => setSaveFeedback('idle'), 3000)
    } finally {
      setSoulSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={cn(
        'fixed right-0 top-0 h-full z-50 flex flex-col bg-background border-l border-border shadow-2xl',
        'animate-in slide-in-from-right-8 duration-300',
        soulEditing ? 'w-full max-w-3xl' : 'w-full max-w-lg'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-lg shadow-inner border border-white/10"
              style={{ background: agent.color || '#3b82f6' }}
            >
              {agent.emoji || '🤖'}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-base leading-tight truncate">{agent.name}</h2>
              <p className="text-xs text-muted-foreground truncate">{agent.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {agent.soulPath && (
              <>
                {view === 'info' ? (
                  <Button size="sm" variant="outline" onClick={handleViewSoul} className="h-8 gap-1.5 text-xs">
                    <FileText className="w-3.5 h-3.5" /> SOUL.md
                  </Button>
                ) : (
                  <>
                    {!soulEditing && (
                      <Button size="sm" variant="outline" onClick={() => { setSoulEditing(true); setEditBuf(soulContent ?? '') }} className="h-8 gap-1.5 text-xs">
                        <Edit className="w-3.5 h-3.5" /> Edit
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { setView('info'); setSoulEditing(false) }} className="h-8 text-xs">
                      <ArrowRight className="w-3.5 h-3.5 rotate-180 mr-1" /> Info
                    </Button>
                  </>
                )}
              </>
            )}
            <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8 shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 pt-3 pb-0 shrink-0">
          {(['info', 'soul'] as const).map(tab => (
            agent.soulPath || tab === 'info' ? (
              <button
                key={tab}
                onClick={() => {
                  setView(tab)
                  if (tab === 'soul') loadSoul()
                }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors',
                  view === tab
                    ? 'border-primary text-foreground bg-muted/40'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab === 'info' ? 'Overview' : 'SOUL.md'}
              </button>
            ) : null
          ))}
        </div>
        <div className="h-px bg-border mx-6 shrink-0" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {view === 'info' ? (
            <div className="p-6 space-y-6">
              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">{agent.description}</p>

              {/* Model */}
              {agent.model && (
                <div className="flex items-center gap-2 text-xs bg-muted/50 w-fit px-3 py-1.5 rounded-lg border border-border/70">
                  <Cpu className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono font-medium">{agent.model}</span>
                </div>
              )}

              {/* Hierarchy */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hierarchy</p>
                <div className="rounded-xl border border-border/70 overflow-hidden divide-y divide-border/50">
                  <div className="flex items-center gap-3 px-4 py-3 text-sm bg-muted/20">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground text-xs">Reports to</span>
                    {parentAgent ? (
                      <span className="ml-auto font-medium flex items-center gap-1.5">
                        <span style={{ background: parentAgent.color || '#888' }} className="w-4 h-4 rounded flex items-center justify-center text-[9px]">
                          {parentAgent.emoji || '🤖'}
                        </span>
                        {parentAgent.name}
                      </span>
                    ) : (
                      <span className="ml-auto text-muted-foreground italic text-xs">None (Orchestrator)</span>
                    )}
                  </div>
                  {directReportAgents.length > 0 && (
                    <div className="px-4 py-3 bg-muted/10">
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Direct reports</span>
                        <span className="ml-auto text-xs text-muted-foreground">{directReportAgents.length}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {directReportAgents.map(r => (
                          <span key={r.id} className="flex items-center gap-1 text-xs bg-muted border border-border px-2 py-0.5 rounded-md font-medium">
                            <span>{r.emoji || '🤖'}</span>{r.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tools */}
              {agent.tools.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <Wrench className="inline w-3 h-3 mr-1 mb-0.5" />Tools
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.tools.map(tool => (
                      <span
                        key={tool}
                        className={cn('text-xs px-2 py-0.5 rounded-md border font-mono font-medium', toolColor(tool))}
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Soul path */}
              {agent.soulPath && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SOUL.md path</p>
                  <code className="text-xs font-mono bg-muted px-3 py-1.5 rounded-md border border-border block text-muted-foreground break-all">
                    {agent.soulPath}
                  </code>
                </div>
              )}

              {/* Agent ID */}
              <div className="rounded-lg bg-muted/30 border border-border/70 px-4 py-3 space-y-1">
                <p className="text-xs text-muted-foreground">Agent ID</p>
                <code className="text-sm font-mono font-medium">{agent.id}</code>
              </div>
            </div>
          ) : (
            /* Soul view */
            <div className="flex flex-col h-full">
              {soulLoading ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading SOUL.md…
                </div>
              ) : soulContent === null || soulContent === '' ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8 text-center">
                  <FileText className="w-10 h-10 opacity-30" />
                  <p className="text-sm">No SOUL.md found at <code className="text-xs bg-muted px-1 rounded">{agent.soulPath}</code></p>
                </div>
              ) : soulEditing ? (
                <div className="flex flex-col h-full p-4 gap-3">
                  <textarea
                    className="flex-1 w-full bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none leading-relaxed"
                    value={editBuf}
                    onChange={e => setEditBuf(e.target.value)}
                    spellCheck={false}
                  />
                  <div className="flex justify-between items-center gap-2 shrink-0">
                    <span className={cn(
                      'text-xs transition-all',
                      saveFeedback === 'saved' ? 'text-emerald-500' : saveFeedback === 'error' ? 'text-destructive' : 'text-transparent'
                    )}>
                      {saveFeedback === 'saved' ? '✓ Saved' : saveFeedback === 'error' ? '⚠ Save failed' : '·'}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSoulEditing(false)} disabled={soulSaving}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveSoul} disabled={soulSaving} className="gap-1.5">
                        {soulSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save SOUL.md
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <pre className="flex-1 p-6 font-mono text-xs text-foreground/80 whitespace-pre-wrap break-words leading-relaxed overflow-auto">
                  {soulContent}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Agent Card (grid view)
// ---------------------------------------------------------------------------

function AgentCard({
  agent,
  allAgents,
  onOpen,
}: {
  agent: AgentEntry
  allAgents: AgentEntry[]
  onOpen: (id: string) => void
}) {
  const directCount = agent.directReports.length
  const isOrchestrator = !agent.reportsTo

  return (
    <div
      className={cn(
        'group relative rounded-2xl border bg-card text-card-foreground cursor-pointer flex flex-col overflow-hidden',
        'hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200'
      )}
      onClick={() => onOpen(agent.id)}
    >
      {/* Color bar */}
      <div className="h-1 w-full flex-shrink-0" style={{ background: agent.color || '#3b82f6' }} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-xl shadow-inner border border-white/10"
              style={{ background: agent.color || '#3b82f6' }}
            >
              {agent.emoji || '🤖'}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight truncate">{agent.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{agent.title}</p>
            </div>
          </div>
          {isOrchestrator && (
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
              Root
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {agent.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
          <div className="flex flex-wrap gap-1">
            {agent.model && (
              <span className="flex items-center gap-1 text-[10px] bg-muted/70 border border-border px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                <Cpu className="w-2.5 h-2.5" />
                {agent.model.split('/').pop()}
              </span>
            )}
            {directCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] bg-muted/70 border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                <GitBranch className="w-2.5 h-2.5" />
                {directCount}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors flex items-center gap-0.5">
            <Eye className="w-3 h-3" /> View
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tree view node
// ---------------------------------------------------------------------------

function TreeNode({
  agent,
  allAgents,
  depth,
  onOpen,
}: {
  agent: AgentEntry
  allAgents: AgentEntry[]
  depth: number
  onOpen: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const children = allAgents.filter(a => a.reportsTo === agent.id)

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer',
          'hover:bg-muted/50 transition-colors group'
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onOpen(agent.id)}
      >
        {/* expand chevron */}
        {children.length > 0 ? (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-3.5 h-3.5 shrink-0" />
        )}

        {/* avatar */}
        <div
          className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-sm"
          style={{ background: agent.color || '#3b82f6' }}
        >
          {agent.emoji || '🤖'}
        </div>

        {/* name + title */}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold truncate">{agent.name}</span>
          <span className="text-xs text-muted-foreground ml-2">{agent.title}</span>
        </div>

        {/* tools chips */}
        <div className="hidden md:flex flex-wrap gap-1 shrink-0">
          {agent.tools.slice(0, 3).map(t => (
            <span key={t} className={cn('text-[10px] px-1.5 py-0.5 rounded border font-mono', toolColor(t))}>
              {t}
            </span>
          ))}
          {agent.tools.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{agent.tools.length - 3}</span>
          )}
        </div>

        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {expanded && children.length > 0 && (
        <div className="border-l border-dashed border-border/50 ml-5">
          {children.map(child => (
            <TreeNode
              key={child.id}
              agent={child}
              allAgents={allAgents}
              depth={depth + 1}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export default function AgentsClient({ initialAgents }: { initialAgents: AgentEntry[] }) {
  const [agents, setAgents] = useState<AgentEntry[]>(initialAgents)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agents')
      if (res.ok) {
        const data = await res.json() as AgentEntry[]
        setAgents(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll every 30s for updates
  useEffect(() => {
    const id = setInterval(() => handleRefresh(), 30_000)
    return () => clearInterval(id)
  }, [handleRefresh])

  // Filtered agents
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return agents
    return agents.filter(a =>
      [a.name, a.title, a.id, a.description].join(' ').toLowerCase().includes(q)
    )
  }, [agents, search])

  // Root agents for tree view
  const roots = useMemo(() =>
    agents.filter(a => !a.reportsTo || !agents.find(p => p.id === a.reportsTo)),
    [agents]
  )

  const detailAgent = detailId ? agents.find(a => a.id === detailId) ?? null : null

  const orchestrators = agents.filter(a => !a.reportsTo).length
  const subAgents = agents.filter(a => a.reportsTo).length

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 pt-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} &middot;&nbsp;
            {orchestrators} orchestrator{orchestrators !== 1 ? 's' : ''} &middot;&nbsp;
            {subAgents} sub-agent{subAgents !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center gap-0.5 bg-muted/50 p-1 rounded-lg border border-border/50">
            {([
              { id: 'grid' as const, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Grid' },
              { id: 'tree' as const, icon: <GitBranch className="w-3.5 h-3.5" />, label: 'Tree' },
            ]).map(v => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  viewMode === v.id
                    ? 'bg-background shadow text-foreground border border-border/50'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {v.icon}
                {v.label}
              </button>
            ))}
          </div>

          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Agents', value: agents.length, icon: <Bot className="w-4 h-4" />, color: 'text-primary' },
          { label: 'Orchestrators', value: orchestrators, icon: <Zap className="w-4 h-4" />, color: 'text-amber-500' },
          { label: 'Sub-agents', value: subAgents, icon: <Users className="w-4 h-4" />, color: 'text-emerald-500' },
          { label: 'With SOUL.md', value: agents.filter(a => a.soulPath).length, icon: <FileText className="w-4 h-4" />, color: 'text-violet-500' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border bg-card p-4 flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-muted/50', stat.color)}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search agents…"
          className="pl-9 h-9"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-dashed py-24 text-center text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Bot className="w-8 h-8 opacity-40" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {agents.length === 0 ? 'No Agents Discovered' : 'No matching agents'}
          </h3>
          <p className="text-sm max-w-xs">
            {agents.length === 0
              ? <>Make sure <code className="text-xs bg-muted px-1.5 py-0.5 rounded">WORKSPACE_PATH</code> is configured and your workspace has an <code className="text-xs bg-muted px-1.5 py-0.5 rounded">agents/</code> directory.</>
              : 'Try a different search term.'
            }
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              allAgents={agents}
              onOpen={setDetailId}
            />
          ))}
        </div>
      ) : (
        /* Tree */
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Agent Hierarchy</span>
            <span className="ml-auto text-xs text-muted-foreground">{filtered.length} agents</span>
          </div>
          <div className="p-3 space-y-0.5">
            {search
              ? /* flat filtered list in tree view */
                filtered.map(agent => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors group"
                    onClick={() => setDetailId(agent.id)}
                  >
                    <div
                      className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-sm"
                      style={{ background: agent.color || '#3b82f6' }}
                    >
                      {agent.emoji || '🤖'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold">{agent.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{agent.title}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))
              : /* hierarchical tree */
                roots.map(root => (
                  <TreeNode
                    key={root.id}
                    agent={root}
                    allAgents={agents}
                    depth={0}
                    onOpen={setDetailId}
                  />
                ))
            }
          </div>
        </div>
      )}

      {/* Detail panel */}
      {detailAgent && (
        <AgentDetailPanel
          agent={detailAgent}
          allAgents={agents}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  )
}
