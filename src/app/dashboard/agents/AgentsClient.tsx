'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RefreshCw, Copy, Check, Star, ChevronDown,
  FileText, Wrench, BookOpen, Radio, Clock,
  LayoutDashboard, Loader2, AlertTriangle,
  Eye, Edit, RotateCcw, Save, X, Maximize2, Minimize2,
  ToggleLeft, ToggleRight, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────
// Types (mirror gateway shape)
// ─────────────────────────────────────────────────────
type AgentRow = {
  id: string
  name?: string
  workspace?: string
  agentDir?: string
  model?: string
  isDefault?: boolean
  bindings?: number
  identityName?: string
  identityEmoji?: string
}

type AgentsListResult = {
  defaultId: string
  agents: AgentRow[]
}

type AgentFileEntry = {
  name: string
  path: string
  missing: boolean
  size?: number
}

type AgentsFilesListResult = {
  agentId: string
  workspace: string
  files: AgentFileEntry[]
}

type SkillStatusEntry = {
  name: string
  description: string
  source: string
  emoji?: string
  always: boolean
  disabled: boolean
  blockedByAllowlist: boolean
  eligible: boolean
  missing?: { bins: string[]; env: string[]; config: string[] }
}

type SkillStatusReport = {
  skills: SkillStatusEntry[]
}

type ChannelAccountSnapshot = {
  accountId: string
  enabled?: boolean | null
  configured?: boolean | null
  connected?: boolean | null
  running?: boolean | null
}

type ChannelsStatusSnapshot = {
  channelOrder: string[]
  channelLabels: Record<string, string>
  channelAccounts: Record<string, ChannelAccountSnapshot[]>
}

type CronJob = {
  id: string
  name: string
  description?: string
  agentId: string
  enabled: boolean
  state?: {
    nextRunAtMs?: number
    lastRunAtMs?: number
    lastRunStatus?: string
  }
}

type CronStatus = {
  enabled: boolean
  jobs: number
  nextWakeAtMs?: number | null
}

type AgentIdentity = {
  name: string
  avatar: string
  emoji?: string
}

type AgentsPanel = 'overview' | 'files' | 'tools' | 'skills' | 'channels' | 'cron'

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────
function relativeTime(ms: number) {
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function nextRunLabel(ms?: number | null) {
  if (!ms) return 'N/A'
  const diff = ms - Date.now()
  if (diff < 0) return 'overdue'
  if (diff < 60_000) return `in ${Math.ceil(diff / 1000)}s`
  if (diff < 3_600_000) return `in ${Math.floor(diff / 60_000)}m`
  return `in ${Math.floor(diff / 3_600_000)}h`
}

// ─────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────

/* ── Loading / Error states ── */
function LoadingCard({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  )
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  )
}

/* ── Overview panel ── */
function OverviewPanel({
  agent,
  defaultId,
  identity,
  identityLoading,
  onGoFiles,
}: {
  agent: AgentRow
  defaultId: string
  identity: AgentIdentity | null
  identityLoading: boolean
  onGoFiles: () => void
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-base">Overview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Workspace paths and identity metadata.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              label: 'Workspace',
              value: (
                <button
                  onClick={onGoFiles}
                  className="font-mono text-xs text-primary hover:underline text-left break-all"
                >
                  {agent.workspace || 'default'}
                </button>
              ),
            },
            {
              label: 'Primary Model',
              value: <span className="font-mono text-xs">{agent.model || '—'}</span>,
            },
            {
              label: 'Agent ID',
              value: <span className="font-mono text-xs">{agent.id}</span>,
            },
            {
              label: 'Identity Name',
              value: identityLoading
                ? <span className="text-muted-foreground text-xs">Loading…</span>
                : <span className="text-xs">{identity?.name || agent.identityName || '—'}</span>,
            },
            {
              label: 'Identity Avatar',
              value: identityLoading
                ? <span className="text-muted-foreground text-xs">Loading…</span>
                : <span className="text-xl">{identity?.emoji || agent.identityEmoji || '—'}</span>,
            },
            {
              label: 'Default Agent',
              value: <span className="text-xs">{agent.id === defaultId ? 'Yes' : 'No'}</span>,
            },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/30 border border-border/60 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
              {value}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Files panel ── */
function FilesPanel({ agentId }: { agentId: string }) {
  const [filesList, setFilesList] = useState<AgentsFilesListResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [contents, setContents] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saved' | 'error'>('idle')
  const [preview, setPreview] = useState(false)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/files`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as AgentsFilesListResult
      setFilesList(data)
      if (data.files.length > 0 && !activeFile) {
        setActiveFile(data.files[0].name)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [agentId, activeFile])

  useEffect(() => { loadFiles() }, [agentId]) // eslint-disable-line

  const loadFileContent = useCallback(async (name: string) => {
    if (contents[name] !== undefined) return
    try {
      const res = await fetch(`/api/agents/${agentId}/files/${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { file: { content?: string } }
      setContents(prev => ({ ...prev, [name]: data.file?.content ?? '' }))
    } catch {}
  }, [agentId, contents])

  const handleSelectFile = (name: string) => {
    setActiveFile(name)
    setPreview(false)
    loadFileContent(name)
  }

  const files = filesList?.files ?? []
  const currentContent = activeFile ? (contents[activeFile] ?? '') : ''
  const currentDraft = activeFile ? (drafts[activeFile] ?? currentContent) : ''
  const isDirty = activeFile ? currentDraft !== currentContent : false

  const handleSave = async () => {
    if (!activeFile) return
    setSaving(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/files/${encodeURIComponent(activeFile)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: currentDraft }),
      })
      if (!res.ok) throw new Error()
      setContents(prev => ({ ...prev, [activeFile]: currentDraft }))
      setDrafts(prev => { const n = { ...prev }; delete n[activeFile]; return n })
      setSaveFeedback('saved')
      setTimeout(() => setSaveFeedback('idle'), 2500)
    } catch {
      setSaveFeedback('error')
      setTimeout(() => setSaveFeedback('idle'), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-base">Core Files</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Bootstrap persona, identity, and tool guidance.</p>
        </div>
        <Button size="sm" variant="outline" onClick={loadFiles} disabled={loading} className="gap-1.5 h-8">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {filesList && (
        <p className="text-xs font-mono text-muted-foreground">Workspace: {filesList.workspace}</p>
      )}

      {error && <ErrorCard msg={error} />}

      {!filesList && !loading && !error && (
        <div className="rounded-lg bg-muted/30 border border-border/50 px-4 py-3 text-sm text-muted-foreground">
          Load the agent workspace files to edit core instructions.
        </div>
      )}

      {files.length > 0 && (
        <>
          {/* File tabs */}
          <div className="flex gap-1 flex-wrap border-b border-border pb-0">
            {files.map(file => {
              const label = file.name.replace(/\.md$/i, '')
              const isActive = activeFile === file.name
              return (
                <button
                  key={file.name}
                  onClick={() => handleSelectFile(file.name)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                    file.missing && 'opacity-60'
                  )}
                >
                  {label}
                  {file.missing && <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-600 px-1 rounded">missing</span>}
                </button>
              )
            })}
          </div>

          {activeFile && (
            <div className="space-y-3">
              {/* file path + actions */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <code className="text-[11px] text-muted-foreground font-mono">
                  {files.find(f => f.name === activeFile)?.path}
                </code>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-xs transition-all',
                    saveFeedback === 'saved' ? 'text-emerald-500' : saveFeedback === 'error' ? 'text-destructive' : 'text-transparent'
                  )}>
                    {saveFeedback === 'saved' ? '✓ Saved' : saveFeedback === 'error' ? '⚠ Error' : '·'}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setPreview(v => !v)}>
                    {preview ? <Edit className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {preview ? 'Edit' : 'Preview'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!isDirty}
                    onClick={() => setDrafts(prev => { const n = { ...prev }; delete n[activeFile!]; return n })}>
                    Reset
                  </Button>
                  <Button size="sm" className="h-7 text-xs gap-1" disabled={saving || !isDirty} onClick={handleSave}>
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save
                  </Button>
                </div>
              </div>

              {preview ? (
                <div className="border border-border rounded-lg p-4 min-h-48 prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap font-mono">
                  {currentDraft || <span className="text-muted-foreground italic">Empty file</span>}
                </div>
              ) : (
                <textarea
                  className="w-full min-h-[360px] bg-muted/20 border border-border rounded-lg p-4 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y leading-relaxed"
                  value={currentDraft}
                  onChange={e => setDrafts(prev => ({ ...prev, [activeFile!]: e.target.value }))}
                  spellCheck={false}
                  placeholder={files.find(f => f.name === activeFile)?.missing ? 'File missing — saving will create it.' : ''}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Skills panel ── */
function SkillsPanel({ agentId }: { agentId: string }) {
  const [report, setReport] = useState<SkillStatusReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/skills`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as SkillStatusReport
      setReport(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skills')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { load() }, [agentId]) // eslint-disable-line

  const skills = report?.skills ?? []
  const q = filter.trim().toLowerCase()
  const filtered = q
    ? skills.filter(s => [s.name, s.description, s.source].join(' ').toLowerCase().includes(q))
    : skills

  const enabledCount = skills.filter(s => !s.disabled && !s.blockedByAllowlist).length

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-base">Skills</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per-agent skill allowlist and workspace skills.
            {skills.length > 0 && <span className="font-mono ml-1">{enabledCount}/{skills.length}</span>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 h-8">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {error && <ErrorCard msg={error} />}
      {loading && !report && <LoadingCard label="Loading skills…" />}

      {report && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search skills…"
              className="pl-9 h-8 text-xs"
            />
          </div>

          <div className="text-xs text-muted-foreground">{filtered.length} shown</div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills found.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(skill => {
                const missing = [
                  ...(skill.missing?.bins ?? []),
                  ...(skill.missing?.env ?? []),
                  ...(skill.missing?.config ?? []),
                ]
                const isEnabled = !skill.disabled && !skill.blockedByAllowlist
                return (
                  <div key={skill.name} className="flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 border border-transparent hover:border-border/50 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {skill.emoji && <span className="mr-1">{skill.emoji}</span>}
                        {skill.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{skill.description}</div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border font-mono">{skill.source}</span>
                        {skill.always && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">always</span>}
                        {skill.blockedByAllowlist && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">allowlisted</span>}
                        {missing.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 border border-red-500/20">missing: {missing.join(', ')}</span>}
                      </div>
                    </div>
                    <div className={cn(
                      'w-2 h-2 rounded-full shrink-0 mt-2',
                      isEnabled && skill.eligible ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    )} title={isEnabled ? 'enabled' : 'disabled'} />
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Tools panel ── */
function ToolsPanel({ agentId }: { agentId: string }) {
  const [catalog, setCatalog] = useState<{ groups?: Array<{ label: string; tools: Array<{ id: string; label: string; description: string }> }> } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/agents/tools-catalog')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCatalog(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tools catalog')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [agentId]) // eslint-disable-line

  const groups = catalog?.groups ?? []
  const totalTools = groups.reduce((n, g) => n + g.tools.length, 0)

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-base">Tool Access</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Available tools catalog.
            {totalTools > 0 && <span className="font-mono ml-1">{totalTools} tools</span>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 h-8">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {error && <ErrorCard msg={error} />}
      {loading && !catalog && <LoadingCard label="Loading tools…" />}

      {groups.length > 0 && (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.label}</p>
              <div className="space-y-1">
                {group.tools.map(tool => (
                  <div key={tool.id} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 border border-transparent hover:border-border/50">
                    <div className="min-w-0">
                      <div className="text-sm font-mono font-medium">{tool.label}</div>
                      <div className="text-xs text-muted-foreground">{tool.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className="text-sm text-muted-foreground">No tools catalog available from gateway.</div>
      )}
    </div>
  )
}

/* ── Channels panel ── */
function ChannelsPanel({ agentId }: { agentId: string }) {
  const [snapshot, setSnapshot] = useState<ChannelsStatusSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSuccess, setLastSuccess] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/agents/channels')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as ChannelsStatusSnapshot
      setSnapshot(data)
      setLastSuccess(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load channels')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [agentId]) // eslint-disable-line

  const channelIds = snapshot
    ? [...new Set([...(snapshot.channelOrder ?? []), ...Object.keys(snapshot.channelAccounts ?? {})])]
    : []

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-base">Channels</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gateway-wide channel status snapshot.
            {lastSuccess && <span className="ml-1">Last: {relativeTime(lastSuccess)}</span>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 h-8">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error && <ErrorCard msg={error} />}
      {loading && !snapshot && <LoadingCard label="Loading channels…" />}

      {!snapshot && !loading && !error && (
        <div className="rounded-lg bg-muted/30 border border-border/50 px-4 py-3 text-sm text-muted-foreground">
          Load channels to see live status.
        </div>
      )}

      {channelIds.length === 0 && snapshot && (
        <p className="text-sm text-muted-foreground">No channels found.</p>
      )}

      {channelIds.length > 0 && (
        <div className="space-y-1">
          {channelIds.map(id => {
            const accounts = snapshot!.channelAccounts?.[id] ?? []
            const label = snapshot!.channelLabels?.[id] ?? id
            const connected = accounts.filter(a => a.connected || a.running).length
            const configured = accounts.filter(a => a.configured).length
            const enabled = accounts.filter(a => a.enabled).length
            const status = accounts.length ? `${connected}/${accounts.length} connected` : 'no accounts'
            return (
              <div key={id} className="flex items-center justify-between gap-3 py-3 px-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs font-mono text-muted-foreground">{id}</div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className={cn('text-xs font-medium', connected > 0 ? 'text-emerald-500' : 'text-muted-foreground')}>
                    {status}
                  </div>
                  <div className="text-xs text-muted-foreground">{configured} configured · {enabled} enabled</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Cron panel ── */
function CronPanel({ agentId }: { agentId: string }) {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [status, setStatus] = useState<CronStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [jobsRes, statusRes] = await Promise.all([
        fetch('/api/crons'),
        fetch('/api/crons?status=1'),
      ])
      if (jobsRes.ok) {
        const data = await jobsRes.json() as { jobs?: CronJob[] }
        setJobs((data.jobs ?? []).filter(j => j.agentId === agentId))
      }
      if (statusRes.ok) {
        const data = await statusRes.json() as { status?: CronStatus }
        setStatus(data.status ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cron jobs')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { load() }, [agentId]) // eslint-disable-line

  const handleRunNow = async (jobId: string) => {
    setRunningId(jobId)
    try {
      await fetch('/api/crons/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', jobId }),
      })
      setTimeout(() => load(), 1000)
    } catch {}
    finally {
      setRunningId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-base">Scheduler</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Gateway cron status.</p>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 h-8">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>

        {error && <ErrorCard msg={error} />}

        {status && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Enabled', value: status.enabled ? 'Yes' : 'No' },
              { label: 'Jobs', value: String(status.jobs) },
              { label: 'Next wake', value: nextRunLabel(status.nextWakeAtMs) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/30 border border-border/60 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
                <p className="text-base font-bold">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Jobs for this agent */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-base">Agent Cron Jobs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Scheduled jobs targeting this agent.</p>
        </div>

        {loading && jobs.length === 0 && <LoadingCard label="Loading jobs…" />}

        {!loading && jobs.length === 0 && (
          <p className="text-sm text-muted-foreground">No jobs assigned to this agent.</p>
        )}

        {jobs.length > 0 && (
          <div className="space-y-2">
            {jobs.map(job => (
              <div key={job.id} className="flex items-start justify-between gap-3 py-3 px-4 rounded-lg border border-border/50 hover:bg-muted/30">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{job.name}</div>
                  {job.description && <div className="text-xs text-muted-foreground mt-0.5">{job.description}</div>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded border',
                      job.enabled
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-muted text-muted-foreground border-border'
                    )}>
                      {job.enabled ? 'enabled' : 'disabled'}
                    </span>
                    {job.state?.lastRunStatus && (
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border font-mono',
                        job.state.lastRunStatus === 'ok' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : job.state.lastRunStatus === 'error' ? 'bg-red-500/10 text-red-600 border-red-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                      )}>
                        last: {job.state.lastRunStatus}
                      </span>
                    )}
                    {job.state?.lastRunAtMs && (
                      <span className="text-[10px] text-muted-foreground">{relativeTime(job.state.lastRunAtMs)}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {job.state?.nextRunAtMs && (
                    <span className="text-xs text-muted-foreground">{nextRunLabel(job.state.nextRunAtMs)}</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!job.enabled || runningId === job.id}
                    onClick={() => handleRunNow(job.id)}
                  >
                    {runningId === job.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Run Now'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Main AgentsClient
// ─────────────────────────────────────────────────────

const TABS: Array<{ id: AgentsPanel; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'files', label: 'Files', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'tools', label: 'Tools', icon: <Wrench className="w-3.5 h-3.5" /> },
  { id: 'skills', label: 'Skills', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'channels', label: 'Channels', icon: <Radio className="w-3.5 h-3.5" /> },
  { id: 'cron', label: 'Cron Jobs', icon: <Clock className="w-3.5 h-3.5" /> },
]

export default function AgentsClient() {
  const [result, setResult] = useState<AgentsListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panel, setPanel] = useState<AgentsPanel>('overview')
  const [identity, setIdentity] = useState<AgentIdentity | null>(null)
  const [identityLoading, setIdentityLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)

  const loadAgents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as AgentsListResult
      setResult(data)
      if (!selectedId && data.agents.length > 0) {
        setSelectedId(data.defaultId ?? data.agents[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => { loadAgents() }, []) // eslint-disable-line

  // Load identity whenever agent changes
  useEffect(() => {
    if (!selectedId) return
    setIdentity(null)
    setIdentityLoading(true)
    fetch(`/api/agents/${selectedId}/identity`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setIdentity(d as AgentIdentity | null))
      .catch(() => setIdentity(null))
      .finally(() => setIdentityLoading(false))
  }, [selectedId])

  const agents = result?.agents ?? []
  const defaultId = result?.defaultId ?? ''
  const selectedAgent = selectedId ? agents.find(a => a.id === selectedId) ?? null : null

  const handleCopyId = async () => {
    if (!selectedAgent) return
    await navigator.clipboard.writeText(selectedAgent.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSetDefault = async () => {
    if (!selectedAgent) return
    setSettingDefault(true)
    try {
      await fetch('/api/agents/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'agents.default': selectedAgent.id }),
      })
      await loadAgents()
    } catch {}
    finally { setSettingDefault(false) }
  }

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 pt-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
        <Button size="sm" variant="outline" onClick={loadAgents} disabled={loading} className="gap-1.5">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {error && <ErrorCard msg={error} />}

      {/* Agent selector toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <select
            value={selectedId ?? ''}
            onChange={e => { setSelectedId(e.target.value); setPanel('overview') }}
            disabled={loading || agents.length === 0}
            className="appearance-none bg-background border border-border rounded-lg px-4 py-2 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 min-w-48"
          >
            {agents.length === 0
              ? <option value="">No agents</option>
              : agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.identityEmoji ? `${a.identityEmoji} ` : ''}{a.name || a.identityName || a.id}
                  {a.id === defaultId ? ' (default)' : ''}
                </option>
              ))
            }
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>

        {selectedAgent && (
          <>
            <Button size="sm" variant="ghost" onClick={handleCopyId} className="gap-1.5 h-9">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy ID'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSetDefault}
              disabled={selectedAgent.id === defaultId || settingDefault}
              className="gap-1.5 h-9"
            >
              <Star className={cn('w-3.5 h-3.5', selectedAgent.id === defaultId && 'fill-amber-400 text-amber-400')} />
              {selectedAgent.id === defaultId ? 'Default' : 'Set Default'}
            </Button>
          </>
        )}
      </div>

      {/* No agent selected */}
      {!selectedAgent && !loading && (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
          Select an agent to inspect its workspace and tools.
        </div>
      )}

      {/* Tabs + panel content */}
      {selectedAgent && (
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="flex gap-0.5 border-b border-border overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setPanel(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                  panel === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel content */}
          {panel === 'overview' && (
            <OverviewPanel
              agent={selectedAgent}
              defaultId={defaultId}
              identity={identity}
              identityLoading={identityLoading}
              onGoFiles={() => setPanel('files')}
            />
          )}
          {panel === 'files' && <FilesPanel agentId={selectedAgent.id} />}
          {panel === 'tools' && <ToolsPanel agentId={selectedAgent.id} />}
          {panel === 'skills' && <SkillsPanel agentId={selectedAgent.id} />}
          {panel === 'channels' && <ChannelsPanel agentId={selectedAgent.id} />}
          {panel === 'cron' && <CronPanel agentId={selectedAgent.id} />}
        </div>
      )}
    </div>
  )
}
