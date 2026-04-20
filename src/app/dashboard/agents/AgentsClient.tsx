'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RefreshCw, ChevronDown,
  FileText, Radio, LayoutDashboard, Loader2, AlertTriangle,
  Eye, Edit, RotateCcw, Save, X, Maximize2, Minimize2,
  ToggleLeft, ToggleRight,
  FolderOpen, Folder, Download, File, FileCode, FileImage,
  FileArchive, Search, SortAsc, SortDesc,
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

type WorkspaceFileEntry = {
  name: string
  relativePath: string
  absolutePath: string
  size: number
  modifiedAt: number
  isDir: boolean
  ext: string
}

type WorkspaceFilesResult = {
  agentId: string
  workspace: string
  files: WorkspaceFileEntry[]
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

type AgentIdentity = {
  name: string
  avatar: string
  emoji?: string
}

type AgentsPanel = 'overview' | 'files' | 'channels' | 'filemanager'

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
function FilesPanel({ agent }: { agent: AgentRow }) {
  const [filesList, setFilesList] = useState<AgentsFilesListResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [contents, setContents] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saved' | 'error'>('idle')
  const [preview, setPreview] = useState(true)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = agent.workspace ? `?workspace=${encodeURIComponent(agent.workspace)}` : ''
      const res = await fetch(`/api/agents/${agent.id}/files${q}`)
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
  }, [agent.id, agent.workspace, activeFile])

  useEffect(() => { loadFiles() }, [agent.id]) // eslint-disable-line

  const loadFileContent = useCallback(async (name: string) => {
    if (contents[name] !== undefined) return
    try {
      const q = agent.workspace ? `?workspace=${encodeURIComponent(agent.workspace)}` : ''
      const res = await fetch(`/api/agents/${agent.id}/files/${encodeURIComponent(name)}${q}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { file: { content?: string } }
      setContents(prev => ({ ...prev, [name]: data.file?.content ?? '' }))
    } catch {}
  }, [agent.id, agent.workspace, contents])

  useEffect(() => {
    if (activeFile) loadFileContent(activeFile)
  }, [activeFile, loadFileContent])

  const handleSelectFile = (name: string) => {
    setActiveFile(name)
    setPreview(true)
  }

  const files = filesList?.files ?? []
  const currentContent = activeFile ? (contents[activeFile] ?? '') : ''
  const currentDraft = activeFile ? (drafts[activeFile] ?? currentContent) : ''
  const isDirty = activeFile ? currentDraft !== currentContent : false

  const handleSave = async () => {
    if (!activeFile) return
    setSaving(true)
    try {
      const q = agent.workspace ? `?workspace=${encodeURIComponent(agent.workspace)}` : ''
      const res = await fetch(`/api/agents/${agent.id}/files/${encodeURIComponent(activeFile)}${q}`, {
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


/* ── File Manager panel ── */
function FileManagerPanel({ agent }: { agent: AgentRow }) {
  const [result, setResult] = useState<WorkspaceFilesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<WorkspaceFileEntry | null>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = agent.workspace ? `?workspace=${encodeURIComponent(agent.workspace)}` : ''
      const res = await fetch(`/api/agents/${agent.id}/workspace-files${q}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as WorkspaceFilesResult
      setResult(data)
      // Auto-expand root dirs
      const rootDirs = data.files.filter(f => f.isDir && !f.relativePath.includes('/'))
      setExpandedDirs(new Set(rootDirs.map(f => f.relativePath)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [agent.id, agent.workspace])

  useEffect(() => { load() }, [agent.id]) // eslint-disable-line

  const handleDownload = async (file: WorkspaceFileEntry) => {
    setDownloading(file.relativePath)
    try {
      const qs = new URLSearchParams({ path: file.relativePath })
      if (agent.workspace) qs.set('workspace', agent.workspace)
      const res = await fetch(`/api/agents/${agent.id}/workspace-files/download?${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Download failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setDownloading(null)
    }
  }

  const handlePreview = async (file: WorkspaceFileEntry) => {
    if (previewFile?.relativePath === file.relativePath) {
      setPreviewFile(null)
      setPreviewContent(null)
      return
    }
    setPreviewFile(file)
    setPreviewContent(null)
    const textExts = new Set(['md', 'txt', 'json', 'csv', 'log', 'yaml', 'yml', 'xml', 'ts', 'js', 'html', 'htm'])
    if (!textExts.has(file.ext)) return
    setPreviewLoading(true)
    try {
      const qs = new URLSearchParams({ path: file.relativePath })
      if (agent.workspace) qs.set('workspace', agent.workspace)
      const res = await fetch(`/api/agents/${agent.id}/workspace-files/download?${qs}`)
      if (!res.ok) throw new Error()
      const text = await res.text()
      setPreviewContent(text)
    } catch {
      setPreviewContent('[Preview unavailable]')
    } finally {
      setPreviewLoading(false)
    }
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  function formatDate(ms: number) {
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function getFileIcon(file: WorkspaceFileEntry) {
    if (file.isDir) return null
    const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
    const codeExts = ['ts', 'js', 'json', 'xml', 'yaml', 'yml']
    if (imgExts.includes(file.ext)) return <FileImage className="w-3.5 h-3.5 text-sky-400 shrink-0" />
    if (codeExts.includes(file.ext)) return <FileCode className="w-3.5 h-3.5 text-violet-400 shrink-0" />
    if (file.ext === 'zip') return <FileArchive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
    if (file.ext === 'pdf') return <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" />
    if (file.ext === 'html' || file.ext === 'htm') return <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />
    return <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
  }

  const allFiles = result?.files ?? []
  const nonDirFiles = allFiles.filter(f => !f.isDir)

  // Filter
  const filtered = search.trim()
    ? nonDirFiles.filter(f => f.relativePath.toLowerCase().includes(search.toLowerCase()))
    : allFiles

  // Sort (only non-search mode maintains tree)
  const sorted = search.trim()
    ? [...filtered].sort((a, b) => {
        const mul = sortAsc ? 1 : -1
        if (sortBy === 'size') return mul * (a.size - b.size)
        if (sortBy === 'date') return mul * (a.modifiedAt - b.modifiedAt)
        return mul * a.relativePath.localeCompare(b.relativePath)
      })
    : filtered

  const toggleDir = (rel: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      next.has(rel) ? next.delete(rel) : next.add(rel)
      return next
    })
  }

  // Tree visibility: show a file if all its parent dirs are expanded
  function isVisible(entry: WorkspaceFileEntry): boolean {
    if (search.trim()) return true // flat search mode
    const parts = entry.relativePath.split('/')
    if (parts.length === 1) return true // root level always visible
    // Check all ancestor dirs are expanded
    for (let i = 1; i < parts.length; i++) {
      const ancestorPath = parts.slice(0, i).join('/')
      if (!expandedDirs.has(ancestorPath)) return false
    }
    return true
  }

  function getDepth(entry: WorkspaceFileEntry): number {
    return entry.relativePath.split('/').length - 1
  }

  const visibleEntries = sorted.filter(isVisible)

  const cycleSort = (col: 'name' | 'size' | 'date') => {
    if (sortBy === col) setSortAsc(v => !v)
    else { setSortBy(col); setSortAsc(true) }
  }

  const SortIcon = ({ col }: { col: 'name' | 'size' | 'date' }) =>
    sortBy === col
      ? sortAsc ? <SortAsc className="w-3 h-3 inline ml-0.5" /> : <SortDesc className="w-3 h-3 inline ml-0.5" />
      : null

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-base">File Manager</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse and download files from the agent workspace.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 h-8">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {result && (
        <p className="text-xs font-mono text-muted-foreground">Workspace: {result.workspace}</p>
      )}

      {error && <ErrorCard msg={error} />}
      {loading && !result && <LoadingCard label="Scanning workspace…" />}

      {!result && !loading && !error && (
        <div className="rounded-lg bg-muted/30 border border-border/50 px-4 py-3 text-sm text-muted-foreground">
          No workspace files loaded yet.
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Search + stats */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search files…"
                className="w-full pl-8 pr-3 h-8 text-xs bg-muted/20 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {nonDirFiles.length} files · {formatSize(nonDirFiles.reduce((s, f) => s + f.size, 0))} total
            </span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_120px_80px] gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
            <button onClick={() => cycleSort('name')} className="text-left hover:text-foreground transition-colors">
              Name <SortIcon col="name" />
            </button>
            <button onClick={() => cycleSort('size')} className="text-right hover:text-foreground transition-colors">
              Size <SortIcon col="size" />
            </button>
            <button onClick={() => cycleSort('date')} className="text-right hover:text-foreground transition-colors">
              Modified <SortIcon col="date" />
            </button>
            <span className="text-right">Actions</span>
          </div>

          {/* File rows */}
          <div className="space-y-0.5 max-h-[480px] overflow-y-auto pr-1">
            {visibleEntries.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">No files found.</div>
            )}
            {visibleEntries.map(entry => {
              const depth = search.trim() ? 0 : getDepth(entry)
              const isExpanded = expandedDirs.has(entry.relativePath)
              const isPreviewing = previewFile?.relativePath === entry.relativePath
              return (
                <div key={entry.relativePath}>
                  <div
                    className={cn(
                      'grid grid-cols-[1fr_80px_120px_80px] gap-2 px-3 py-2 rounded-lg text-xs hover:bg-muted/40 transition-colors items-center group',
                      isPreviewing && 'bg-primary/5 border border-primary/20'
                    )}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                  >
                    {/* Name */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      {entry.isDir ? (
                        <button
                          onClick={() => toggleDir(entry.relativePath)}
                          className="flex items-center gap-1.5 min-w-0 hover:text-foreground text-muted-foreground"
                        >
                          {isExpanded
                            ? <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            : <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          <span className="truncate font-medium">{entry.name}/</span>
                        </button>
                      ) : (
                        <>
                          {getFileIcon(entry)}
                          <span className="truncate text-foreground/90">{entry.name}</span>
                        </>
                      )}
                    </div>

                    {/* Size */}
                    <div className="text-right text-muted-foreground">
                      {entry.isDir ? '—' : formatSize(entry.size)}
                    </div>

                    {/* Date */}
                    <div className="text-right text-muted-foreground">
                      {formatDate(entry.modifiedAt)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      {!entry.isDir && (
                        <>
                          <button
                            onClick={() => handlePreview(entry)}
                            className={cn(
                              'p-1 rounded hover:bg-muted transition-colors',
                              isPreviewing ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                            )}
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownload(entry)}
                            disabled={downloading === entry.relativePath}
                            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            title="Download"
                          >
                            {downloading === entry.relativePath
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Download className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline preview */}
                  {isPreviewing && !entry.isDir && (
                    <div className="mx-3 mb-2 rounded-lg border border-border bg-muted/20 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
                        <span className="text-[11px] font-mono text-muted-foreground">{entry.relativePath}</span>
                        <button
                          onClick={() => { setPreviewFile(null); setPreviewContent(null) }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-3 max-h-64 overflow-auto text-xs font-mono whitespace-pre-wrap">
                        {previewLoading
                          ? <span className="text-muted-foreground">Loading preview…</span>
                          : previewContent ?? <span className="text-muted-foreground italic">Binary or unsupported preview — use Download.</span>
                        }
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
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


// ─────────────────────────────────────────────────────
// Main AgentsClient
// ─────────────────────────────────────────────────────

const TABS: Array<{ id: AgentsPanel; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'files', label: 'Files', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'channels', label: 'Channels', icon: <Radio className="w-3.5 h-3.5" /> },
  { id: 'filemanager', label: 'File Manager', icon: <FolderOpen className="w-3.5 h-3.5" /> },
]

export default function AgentsClient() {
  const [result, setResult] = useState<AgentsListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panel, setPanel] = useState<AgentsPanel>('overview')
  const [identity, setIdentity] = useState<AgentIdentity | null>(null)
  const [identityLoading, setIdentityLoading] = useState(false)

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

  const agents = result?.agents ?? []
  const defaultId = result?.defaultId ?? ''
  const selectedAgent = selectedId ? agents.find(a => a.id === selectedId) ?? null : null

  // Load identity whenever agent changes
  useEffect(() => {
    if (!selectedAgent) return
    setIdentity(null)
    setIdentityLoading(true)
    const q = selectedAgent.workspace ? `?workspace=${encodeURIComponent(selectedAgent.workspace)}` : ''
    fetch(`/api/agents/${selectedAgent.id}/identity${q}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setIdentity(d as AgentIdentity | null))
      .catch(() => setIdentity(null))
      .finally(() => setIdentityLoading(false))
  }, [selectedAgent])


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
              ? <option value="">{loading ? 'Loading agents...' : 'No agents'}</option>
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

      </div>

      {/* Loading state skeleton */}
      {loading && !selectedAgent && (
        <div className="space-y-4 animate-pulse">
          <div className="flex gap-2 border-b border-border pb-px">
            <div className="h-8 w-24 bg-muted/60 rounded-t-md"></div>
            <div className="h-8 w-24 bg-muted/60 rounded-t-md"></div>
            <div className="h-8 w-24 bg-muted/60 rounded-t-md"></div>
          </div>
          <div className="h-[400px] w-full bg-muted/30 rounded-xl border border-border"></div>
        </div>
      )}

      {/* No agent selected */}
      {!selectedAgent && !loading && (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground text-sm">
          Select an agent to inspect its workspace and tools.
        </div>
      )}

      {/* Tabs + panel content */}
      {selectedAgent && (
        <div key={selectedAgent.id} className="space-y-4">
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
          <div className={panel === 'overview' ? 'block' : 'hidden'}>
            <OverviewPanel
              agent={selectedAgent}
              defaultId={defaultId}
              identity={identity}
              identityLoading={identityLoading}
              onGoFiles={() => setPanel('files')}
            />
          </div>
          <div className={panel === 'files' ? 'block' : 'hidden'}>
            <FilesPanel agent={selectedAgent} />
          </div>
          <div className={panel === 'channels' ? 'block' : 'hidden'}>
            <ChannelsPanel agentId={selectedAgent.id} />
          </div>
          <div className={panel === 'filemanager' ? 'block' : 'hidden'}>
            <FileManagerPanel agent={selectedAgent} />
          </div>
        </div>
      )}
    </div>
  )
}
