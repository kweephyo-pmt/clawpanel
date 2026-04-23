'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, ChevronDown, Loader2, AlertTriangle,
  FolderOpen, Folder, Download, File, FileCode, FileImage,
  FileArchive, FileText, Search, ArrowUpDown, ArrowUp, ArrowDown,
  Eye, X, List, GitBranch, ChevronsUpDown, ChevronsDownUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────
type AgentRow = {
  id: string
  name?: string
  workspace?: string
  identityName?: string
  identityEmoji?: string
  isDefault?: boolean
}

type AgentsListResult = {
  defaultId: string
  agents: AgentRow[]
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

type SortCol = 'name' | 'size' | 'date'
type ViewMode = 'tree' | 'flat'

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────
function formatSize(bytes: number) {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function getFileIcon(file: WorkspaceFileEntry) {
  const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
  const codeExts = ['ts', 'js', 'json', 'xml', 'yaml', 'yml']
  if (imgExts.includes(file.ext)) return <FileImage className="w-3.5 h-3.5 text-sky-400 shrink-0" />
  if (codeExts.includes(file.ext)) return <FileCode className="w-3.5 h-3.5 text-violet-400 shrink-0" />
  if (file.ext === 'zip') return <FileArchive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
  if (file.ext === 'pdf') return <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" />
  if (file.ext === 'html' || file.ext === 'htm') return <FileCode className="w-3.5 h-3.5 text-orange-400 shrink-0" />
  if (file.ext === 'md') return <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
  if (file.ext === 'csv') return <FileText className="w-3.5 h-3.5 text-lime-400 shrink-0" />
  return <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
}

function getExtBadgeColor(ext: string) {
  const map: Record<string, string> = {
    pdf: 'bg-red-500/10 text-red-400',
    html: 'bg-orange-500/10 text-orange-400',
    htm: 'bg-orange-500/10 text-orange-400',
    md: 'bg-emerald-500/10 text-emerald-400',
    json: 'bg-violet-500/10 text-violet-400',
    ts: 'bg-violet-500/10 text-violet-400',
    js: 'bg-yellow-500/10 text-yellow-400',
    csv: 'bg-lime-500/10 text-lime-400',
    png: 'bg-sky-500/10 text-sky-400',
    jpg: 'bg-sky-500/10 text-sky-400',
    zip: 'bg-amber-500/10 text-amber-400',
  }
  return map[ext] ?? 'bg-muted/50 text-muted-foreground'
}

// Compute dir sizes from children
function computeDirSizes(files: WorkspaceFileEntry[]): Record<string, number> {
  const sizes: Record<string, number> = {}
  for (const f of files) {
    if (f.isDir) continue
    const parts = f.relativePath.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/')
      sizes[dirPath] = (sizes[dirPath] ?? 0) + f.size
    }
  }
  return sizes
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  )
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Sort icon
// ─────────────────────────────────────────────────────
function SortButton({
  label, col, sortBy, sortAsc, onClick,
}: { label: string; col: SortCol; sortBy: SortCol; sortAsc: boolean; onClick: () => void }) {
  const active = sortBy === col
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      {active
        ? sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        : <ArrowUpDown className="w-3 h-3 opacity-40" />}
    </button>
  )
}

// ─────────────────────────────────────────────────────
// File row
// ─────────────────────────────────────────────────────
function FileRow({
  entry,
  depth,
  isExpanded,
  isPreviewing,
  isDownloading,
  dirSize,
  viewMode,
  onToggleDir,
  onPreview,
  onDownload,
}: {
  entry: WorkspaceFileEntry
  depth: number
  isExpanded: boolean
  isPreviewing: boolean
  isDownloading: boolean
  dirSize: number
  viewMode: ViewMode
  onToggleDir: () => void
  onPreview: () => void
  onDownload: () => void
}) {
  const showGuide = viewMode === 'tree' && depth > 0

  return (
    <div
      className={cn(
        'relative grid items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors group',
        'grid-cols-[1fr_80px_130px_72px]',
        isPreviewing ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/40',
      )}
      style={{ paddingLeft: viewMode === 'tree' ? `${10 + depth * 18}px` : undefined }}
    >
      {/* Tree guide lines for nested items */}
      {showGuide && Array.from({ length: depth }).map((_, i) => (
        <span
          key={i}
          className="absolute top-0 bottom-0 border-l border-border/40"
          style={{ left: `${10 + i * 18 + 7}px` }}
        />
      ))}
      {showGuide && (
        <span
          className="absolute border-b border-border/40"
          style={{
            left: `${10 + (depth - 1) * 18 + 7}px`,
            width: '8px',
            top: '50%',
          }}
        />
      )}
      {/* Name */}
      <div className="flex items-center gap-2 min-w-0">
        {entry.isDir ? (
          <button
            onClick={onToggleDir}
            className="flex items-center gap-2 min-w-0 text-left"
          >
            {isExpanded
              ? <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              : <Folder className="w-3.5 h-3.5 text-amber-400/70 shrink-0" />}
            <span className={cn('truncate font-medium', isExpanded ? 'text-foreground' : 'text-muted-foreground')}>
              {entry.name}
            </span>
          </button>
        ) : (
          <>
            {getFileIcon(entry)}
            <span className="truncate text-foreground/90">{entry.name}</span>
            {entry.ext && (
              <span className={cn('shrink-0 text-[9px] font-bold uppercase px-1 py-0.5 rounded', getExtBadgeColor(entry.ext))}>
                {entry.ext}
              </span>
            )}
            {viewMode === 'flat' && (
              <span className="text-[10px] text-muted-foreground truncate hidden sm:block ml-1 shrink-0">
                /{entry.relativePath.split('/').slice(0, -1).join('/')}
              </span>
            )}
          </>
        )}
      </div>

      {/* Size */}
      <div className="text-right text-muted-foreground tabular-nums">
        {entry.isDir ? (dirSize > 0 ? formatSize(dirSize) : '—') : formatSize(entry.size)}
      </div>

      {/* Modified */}
      <div className="text-right text-muted-foreground">
        {formatDate(entry.modifiedAt)}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5">
        {!entry.isDir && (
          <>
            <button
              onClick={onPreview}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                isPreviewing
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted'
              )}
              title="Preview"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground opacity-0 group-hover:opacity-100 disabled:opacity-30"
              title="Download"
            >
              {isDownloading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────
export default function FilesClient() {
  const [agentsResult, setAgentsResult] = useState<AgentsListResult | null>(null)
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentsError, setAgentsError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [result, setResult] = useState<WorkspaceFilesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('tree')
  const [sortBy, setSortBy] = useState<SortCol>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const [downloading, setDownloading] = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<WorkspaceFileEntry | null>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Load agents
  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((data: AgentsListResult) => {
        setAgentsResult(data)
        setSelectedId(data.defaultId ?? data.agents[0]?.id ?? null)
      })
      .catch(e => setAgentsError(String(e)))
      .finally(() => setAgentsLoading(false))
  }, [])

  const selectedAgent = agentsResult?.agents.find(a => a.id === selectedId) ?? null

  const loadFiles = useCallback(async (agent: AgentRow) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setSearch('')
    setPreviewFile(null)
    setPreviewContent(null)
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
  }, [])

  useEffect(() => {
    if (selectedAgent) loadFiles(selectedAgent)
  }, [selectedAgent?.id]) // eslint-disable-line

  const handleDownload = async (file: WorkspaceFileEntry) => {
    if (!selectedAgent) return
    setDownloading(file.relativePath)
    try {
      const qs = new URLSearchParams({ path: file.relativePath })
      if (selectedAgent.workspace) qs.set('workspace', selectedAgent.workspace)
      const res = await fetch(`/api/agents/${selectedAgent.id}/workspace-files/download?${qs}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = file.name; a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`Download failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setDownloading(null)
    }
  }

  const TEXT_EXTS = new Set(['md', 'txt', 'json', 'csv', 'log', 'yaml', 'yml', 'xml', 'ts', 'js', 'html', 'htm'])

  const handlePreview = async (file: WorkspaceFileEntry) => {
    if (!selectedAgent) return
    if (previewFile?.relativePath === file.relativePath) {
      setPreviewFile(null); setPreviewContent(null); return
    }
    setPreviewFile(file); setPreviewContent(null)
    if (!TEXT_EXTS.has(file.ext)) return
    setPreviewLoading(true)
    try {
      const qs = new URLSearchParams({ path: file.relativePath })
      if (selectedAgent.workspace) qs.set('workspace', selectedAgent.workspace)
      const res = await fetch(`/api/agents/${selectedAgent.id}/workspace-files/download?${qs}`)
      if (!res.ok) throw new Error()
      setPreviewContent(await res.text())
    } catch {
      setPreviewContent('[Preview unavailable]')
    } finally {
      setPreviewLoading(false)
    }
  }

  const toggleDir = (rel: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      next.has(rel) ? next.delete(rel) : next.add(rel)
      return next
    })
  }

  const expandAll = () => {
    const dirs = (result?.files ?? []).filter(f => f.isDir).map(f => f.relativePath)
    setExpandedDirs(new Set(dirs))
  }

  const collapseAll = () => setExpandedDirs(new Set())

  const cycleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortAsc(v => !v)
    } else {
      setSortBy(col)
      setSortAsc(true)
      // Switch to flat mode when sorting by size or date so it makes visual sense
      if (col === 'size' || col === 'date') setViewMode('flat')
    }
  }

  // ── Data processing ──
  const allFiles = result?.files ?? []
  const allNonDirFiles = allFiles.filter(f => !f.isDir)
  const dirSizes = computeDirSizes(allFiles)
  const totalSize = allNonDirFiles.reduce((s, f) => s + f.size, 0)

  // Search filters to flat file-only list
  const isSearching = search.trim().length > 0
  const effectiveMode = isSearching ? 'flat' : viewMode

  const baseList: WorkspaceFileEntry[] = isSearching
    ? allNonDirFiles.filter(f => f.relativePath.toLowerCase().includes(search.toLowerCase()))
    : effectiveMode === 'flat'
      ? allNonDirFiles
      : allFiles

  // Apply sort
  const sorted = [...baseList].sort((a, b) => {
    const mul = sortAsc ? 1 : -1
    if (effectiveMode === 'tree' && !isSearching) {
      // Tree sort: append '/' to dir paths so their children always
      // sort immediately after the dir and before unrelated siblings.
      // e.g. "agents/" < "agents/AGENTS.md" < "agents/seo-bot" < "seo-bot.md"
      const aKey = a.isDir ? a.relativePath + '/' : a.relativePath
      const bKey = b.isDir ? b.relativePath + '/' : b.relativePath
      return aKey.localeCompare(bKey)
    }
    if (sortBy === 'size') return mul * (a.size - b.size)
    if (sortBy === 'date') return mul * (a.modifiedAt - b.modifiedAt)
    return mul * a.name.localeCompare(b.name)
  })

  // Tree visibility
  function isVisible(entry: WorkspaceFileEntry): boolean {
    if (effectiveMode === 'flat') return true
    const parts = entry.relativePath.split('/')
    if (parts.length === 1) return true
    for (let i = 1; i < parts.length; i++) {
      if (!expandedDirs.has(parts.slice(0, i).join('/'))) return false
    }
    return true
  }

  function getDepth(entry: WorkspaceFileEntry): number {
    return entry.relativePath.split('/').length - 1
  }

  const visibleEntries = sorted.filter(isVisible)
  const agents = agentsResult?.agents ?? []

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 pt-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">File Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and download files from the agent workspace.
          </p>
        </div>
        {selectedAgent && (
          <Button size="sm" variant="outline" onClick={() => loadFiles(selectedAgent)} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        )}
      </div>

      {agentsError && <ErrorCard msg={agentsError} />}

      {/* Agent selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm text-muted-foreground font-medium shrink-0">Agent:</label>
        <div className="relative">
          <select
            value={selectedId ?? ''}
            onChange={e => setSelectedId(e.target.value)}
            disabled={agentsLoading || agents.length === 0}
            className="appearance-none bg-background border border-border rounded-lg px-4 py-2 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 min-w-52"
          >
            {agentsLoading
              ? <option value="">Loading agents…</option>
              : agents.length === 0
                ? <option value="">No agents found</option>
                : agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.identityEmoji ? `${a.identityEmoji} ` : ''}{a.name || a.identityName || a.id}
                    {a.id === agentsResult?.defaultId ? ' (default)' : ''}
                  </option>
                ))
            }
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {result && (
          <span className="text-xs font-mono text-muted-foreground truncate hidden sm:block">
            {result.workspace}
          </span>
        )}
      </div>

      {error && <ErrorCard msg={error} />}
      {loading && <LoadingCard label="Scanning workspace…" />}

      {!result && !loading && !error && selectedAgent && (
        <div className="rounded-xl border bg-card px-6 py-16 text-center text-muted-foreground text-sm">
          Loading workspace files…
        </div>
      )}

      {result && (
        <div className="rounded-xl border bg-card overflow-hidden flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
          {/* Stats bar */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/20 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <File className="w-3 h-3" />
                <strong className="text-foreground">{allNonDirFiles.length}</strong> files
              </span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1.5">
                <Folder className="w-3 h-3" />
                <strong className="text-foreground">{allFiles.filter(f => f.isDir).length}</strong> folders
              </span>
              <span className="text-border">·</span>
              <span><strong className="text-foreground">{formatSize(totalSize)}</strong> total</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* Expand/Collapse — tree mode only */}
              {effectiveMode === 'tree' && (
                <div className="flex items-center rounded-md border border-border overflow-hidden">
                  <button
                    onClick={expandAll}
                    className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Expand all"
                  >
                    <ChevronsUpDown className="w-3 h-3" /> All
                  </button>
                  <div className="w-px h-4 bg-border" />
                  <button
                    onClick={collapseAll}
                    className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Collapse all"
                  >
                    <ChevronsDownUp className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* View mode toggle */}
              {!isSearching && (
                <div className="flex items-center rounded-md border border-border overflow-hidden">
                  <button
                    onClick={() => { setViewMode('tree'); setSortBy('name'); setSortAsc(true) }}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium transition-colors',
                      viewMode === 'tree' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    title="Tree view"
                  >
                    <GitBranch className="w-3 h-3" /> Tree
                  </button>
                  <button
                    onClick={() => setViewMode('flat')}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium transition-colors',
                      viewMode === 'flat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    title="Flat list"
                  >
                    <List className="w-3 h-3" /> List
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Toolbar: search + sort */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search files…"
                className="w-full pl-8 pr-3 h-8 text-sm bg-muted/20 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort buttons (only in flat/search mode) */}
            {(effectiveMode === 'flat' || isSearching) && (
              <div className="flex items-center gap-1 border border-border rounded-lg px-3 py-1.5 bg-muted/10">
                <span className="text-[10px] text-muted-foreground mr-1.5 uppercase tracking-wide font-semibold shrink-0">Sort:</span>
                <SortButton label="Name" col="name" sortBy={sortBy} sortAsc={sortAsc} onClick={() => cycleSort('name')} />
                <div className="w-px h-3 bg-border mx-1.5" />
                <SortButton label="Size" col="size" sortBy={sortBy} sortAsc={sortAsc} onClick={() => cycleSort('size')} />
                <div className="w-px h-3 bg-border mx-1.5" />
                <SortButton label="Date" col="date" sortBy={sortBy} sortAsc={sortAsc} onClick={() => cycleSort('date')} />
              </div>
            )}

            {isSearching && (
              <span className="text-xs text-muted-foreground shrink-0">
                {visibleEntries.length} result{visibleEntries.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_80px_130px_72px] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/10">
            <span className="pl-2">Name</span>
            <span className="text-right">Size</span>
            <span className="text-right">Modified</span>
            <span className="text-right pr-1">Actions</span>
          </div>

          {/* File rows */}
          <div className="divide-y divide-border/40 flex-1 overflow-y-auto min-h-0">
            {visibleEntries.length === 0 && (
              <div className="py-16 text-center text-sm text-muted-foreground">
                {isSearching ? `No files matching "${search}"` : 'No files found in this workspace.'}
              </div>
            )}
            {visibleEntries.map(entry => {
              const depth = effectiveMode === 'tree' ? getDepth(entry) : 0
              const isExpanded = expandedDirs.has(entry.relativePath)
              const isPreviewing = previewFile?.relativePath === entry.relativePath

              return (
                <div key={entry.relativePath}>
                  <FileRow
                    entry={entry}
                    depth={depth}
                    isExpanded={isExpanded}
                    isPreviewing={isPreviewing}
                    isDownloading={downloading === entry.relativePath}
                    dirSize={dirSizes[entry.relativePath] ?? 0}
                    viewMode={effectiveMode}
                    onToggleDir={() => toggleDir(entry.relativePath)}
                    onPreview={() => handlePreview(entry)}
                    onDownload={() => handleDownload(entry)}
                  />

                  {/* Inline preview */}
                  {isPreviewing && !entry.isDir && (
                    <div className="border-t border-border bg-muted/10">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Eye className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[11px] font-mono text-muted-foreground">{entry.relativePath}</span>
                          <span className={cn('text-[9px] font-bold uppercase px-1 py-0.5 rounded', getExtBadgeColor(entry.ext))}>
                            {entry.ext || 'file'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownload(entry)}
                            disabled={downloading === entry.relativePath}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          >
                            <Download className="w-3 h-3" /> Download
                          </button>
                          <button
                            onClick={() => { setPreviewFile(null); setPreviewContent(null) }}
                            className="text-muted-foreground hover:text-foreground p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="p-4 max-h-80 overflow-auto font-mono text-xs whitespace-pre-wrap bg-[hsl(var(--muted)/0.3)] leading-relaxed">
                        {previewLoading
                          ? <span className="text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />Loading preview…</span>
                          : previewContent !== null
                            ? previewContent || <span className="text-muted-foreground italic">Empty file</span>
                            : <span className="text-muted-foreground italic">Binary or unsupported preview — use Download button above.</span>
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
