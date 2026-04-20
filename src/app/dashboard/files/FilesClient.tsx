'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, ChevronDown, Loader2, AlertTriangle,
  FolderOpen, Folder, Download, File, FileCode, FileImage,
  FileArchive, FileText, Search, SortAsc, SortDesc, Eye, X,
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
  return <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
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
    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> {label}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// File Manager
// ─────────────────────────────────────────────────────
export default function FilesClient() {
  // Agent selection
  const [agentsResult, setAgentsResult] = useState<AgentsListResult | null>(null)
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentsError, setAgentsError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // File tree
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

  // Load agents list
  useEffect(() => {
    setAgentsLoading(true)
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

  // Load workspace files whenever agent changes
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
    if (!selectedAgent) return
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
      if (selectedAgent.workspace) qs.set('workspace', selectedAgent.workspace)
      const res = await fetch(`/api/agents/${selectedAgent.id}/workspace-files/download?${qs}`)
      if (!res.ok) throw new Error()
      const text = await res.text()
      setPreviewContent(text)
    } catch {
      setPreviewContent('[Preview unavailable]')
    } finally {
      setPreviewLoading(false)
    }
  }

  // ── Tree/filter logic ──
  const allFiles = result?.files ?? []
  const nonDirFiles = allFiles.filter(f => !f.isDir)

  const filtered = search.trim()
    ? nonDirFiles.filter(f => f.relativePath.toLowerCase().includes(search.toLowerCase()))
    : allFiles

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

  function isVisible(entry: WorkspaceFileEntry): boolean {
    if (search.trim()) return true
    const parts = entry.relativePath.split('/')
    if (parts.length === 1) return true
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

  const agents = agentsResult?.agents ?? []

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 pt-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">File Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and download files from the agent workspace.
          </p>
        </div>
        {selectedAgent && (
          <Button
            size="sm" variant="outline"
            onClick={() => loadFiles(selectedAgent)}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        )}
      </div>

      {agentsError && <ErrorCard msg={agentsError} />}

      {/* Agent selector */}
      <div className="flex items-center gap-3">
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

      {/* Content */}
      {error && <ErrorCard msg={error} />}
      {loading && <LoadingCard label="Scanning workspace…" />}

      {!result && !loading && !error && selectedAgent && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center text-muted-foreground text-sm">
          Select an agent to browse its workspace files.
        </div>
      )}

      {result && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          {/* Search + stats */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search files…"
                className="w-full pl-8 pr-3 h-9 text-sm bg-muted/20 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {nonDirFiles.length} files · {formatSize(nonDirFiles.reduce((s, f) => s + f.size, 0))} total
            </span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_90px_130px_80px] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border">
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
          <div className="space-y-0.5 max-h-[560px] overflow-y-auto pr-1">
            {visibleEntries.length === 0 && (
              <div className="text-sm text-muted-foreground py-10 text-center">No files found.</div>
            )}
            {visibleEntries.map(entry => {
              const depth = search.trim() ? 0 : getDepth(entry)
              const isExpanded = expandedDirs.has(entry.relativePath)
              const isPreviewing = previewFile?.relativePath === entry.relativePath
              return (
                <div key={entry.relativePath}>
                  <div
                    className={cn(
                      'grid grid-cols-[1fr_90px_130px_80px] gap-2 px-3 py-2 rounded-lg text-xs hover:bg-muted/40 transition-colors items-center group',
                      isPreviewing && 'bg-primary/5 border border-primary/20'
                    )}
                    style={{ paddingLeft: `${12 + depth * 18}px` }}
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
                          {search.trim() && (
                            <span className="text-[10px] text-muted-foreground truncate hidden sm:block ml-1">
                              {entry.relativePath.split('/').slice(0, -1).join('/')}
                            </span>
                          )}
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
                              'p-1.5 rounded hover:bg-muted transition-colors',
                              isPreviewing ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
                            )}
                            title="Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDownload(entry)}
                            disabled={downloading === entry.relativePath}
                            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground opacity-0 group-hover:opacity-100 disabled:opacity-50"
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
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                        <span className="text-[11px] font-mono text-muted-foreground">{entry.relativePath}</span>
                        <button
                          onClick={() => { setPreviewFile(null); setPreviewContent(null) }}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-4 max-h-80 overflow-auto text-xs font-mono whitespace-pre-wrap">
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
