'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, ChevronDown, FileText, Radio, LayoutDashboard,
  Loader2, AlertTriangle, Eye, Edit, Save, X, Plus, Star,
  CheckCircle2, Circle, Zap, Cpu, Wrench, Bot, Sparkles,
  Check, ChevronRight,
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
  agentDir?: string
  model?: string
  isDefault?: boolean
  bindings?: number
  identityName?: string
  identityEmoji?: string
  routes?: string[]
}

type AgentsListResult = {
  defaultId: string
  agents: AgentRow[]
}

type AgentFileEntry = { name: string; path: string; missing: boolean; size?: number }
type AgentsFilesListResult = { agentId: string; workspace: string; files: AgentFileEntry[] }

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

type SkillEntry = { id: string; name: string; description?: string; emoji?: string; enabled?: boolean }

type AgentIdentity = { name: string; avatar: string; emoji?: string }
type AgentsPanel = 'overview' | 'files' | 'channels'

type ModelEntry = { id: string; label: string; provider?: string }

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

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{msg}</span>
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
// Agent Card
// ─────────────────────────────────────────────────────
function AgentCard({
  agent, defaultId, isSelected, channelConnected, onSelect, onSetDefault, settingDefault,
}: {
  agent: AgentRow
  defaultId: string
  isSelected: boolean
  channelConnected: number
  onSelect: () => void
  onSetDefault: () => void
  settingDefault: boolean
}) {
  const isDefault = agent.id === defaultId
  const emoji = agent.identityEmoji || '🤖'
  const name = agent.identityName || agent.name || agent.id

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-card p-4 cursor-pointer transition-all duration-150 group',
        isSelected
          ? 'border-primary ring-1 ring-primary/30 bg-primary/3'
          : 'border-border hover:border-border/80 hover:bg-muted/20'
      )}
      onClick={onSelect}
    >
      {/* Default badge */}
      {isDefault && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
          <Star className="w-2.5 h-2.5 fill-current" /> Default
        </div>
      )}

      {/* Avatar + name */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center text-xl shrink-0">
          {emoji}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{name}</div>
          <div className="text-[11px] font-mono text-muted-foreground truncate">{agent.id}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Cpu className="w-3 h-3 shrink-0" />
          <span className="truncate font-mono">{agent.model || 'default model'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', channelConnected > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
          <span className={cn('text-xs', channelConnected > 0 ? 'text-emerald-500' : 'text-muted-foreground')}>
            {channelConnected > 0 ? `${channelConnected} channel${channelConnected > 1 ? 's' : ''} connected` : 'No channels connected'}
          </span>
        </div>
        {agent.workspace && (
          <div className="text-[10px] font-mono text-muted-foreground truncate">
            {agent.workspace.replace(/^\/home\/[^/]+/, '~')}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={isSelected ? 'default' : 'outline'}
          className="h-7 text-xs flex-1"
          onClick={e => { e.stopPropagation(); onSelect() }}
        >
          {isSelected ? <><Check className="w-3 h-3 mr-1" />Selected</> : <>Inspect<ChevronRight className="w-3 h-3 ml-1" /></>}
        </Button>
        {!isDefault && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2"
            disabled={settingDefault}
            onClick={e => { e.stopPropagation(); onSetDefault() }}
            title="Set as default"
          >
            {settingDefault ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Create Agent Wizard
// ─────────────────────────────────────────────────────
function CreateAgentWizard({
  skills,
  onClose,
  onCreated,
}: {
  skills: SkillEntry[]
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🤖')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('')
  const [catalogModels, setCatalogModels] = useState<ModelEntry[]>([])
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const agentId = slugify(name) || 'new-agent'

  useEffect(() => {
    fetch('/api/providers/catalog')
      .then(res => res.json())
      .then(data => setCatalogModels(data.models || []))
      .catch(console.error)
  }, [])

  const toggleSkill = (id: string) => {
    setSelectedSkills(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: agentId,
          name,
          emoji,
          description,
          model: model || undefined,
          skills: Array.from(selectedSkills),
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create agent')
      setCreating(false)
    }
  }

  const canNext1 = name.trim().length >= 2 && description.trim().length >= 10

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-base">Create Agent</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex h-1 bg-muted/30">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={cn('flex-1 transition-all duration-300', step >= s ? 'bg-primary' : 'bg-transparent')}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 py-5 space-y-4">
          {/* Step 1: Identity */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-3">Who is this agent?</p>
                <div className="flex gap-3 mb-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={emoji}
                      onChange={e => setEmoji(e.target.value)}
                      className="w-14 h-14 text-center text-2xl bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                      maxLength={2}
                    />
                    <span className="absolute -bottom-4 left-0 right-0 text-center text-[9px] text-muted-foreground">emoji</span>
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Agent name (e.g. SEO Bot)"
                    className="flex-1 h-14 px-4 text-sm bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                  />
                </div>
                {name && (
                  <p className="text-[11px] text-muted-foreground font-mono">ID: {agentId}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  What does this agent do?
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the agent's purpose, focus area, and responsibilities. This becomes the agent's SOUL.md..."
                  className="w-full h-28 px-4 py-3 text-sm bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{description.length} chars</p>
              </div>
            </div>
          )}

          {/* Step 2: Skills */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Which skills should this agent have?</p>
              <p className="text-xs text-muted-foreground">Select the skills relevant to this agent's focus area. Fewer is better — keep it focused.</p>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {skills.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">No skills found. Agent will use all available skills.</p>
                )}
                {skills.map(skill => {
                  const selected = selectedSkills.has(skill.id)
                  return (
                    <button
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors border',
                        selected
                          ? 'bg-primary/8 border-primary/30 text-foreground'
                          : 'bg-muted/10 border-border/50 text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                      )}
                    >
                      <div className={cn('w-4 h-4 rounded border shrink-0 flex items-center justify-center text-xs transition-colors',
                        selected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                      )}>
                        {selected && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <span className="text-base shrink-0">{skill.emoji || '🔧'}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium">{skill.name || skill.id}</div>
                        {skill.description && <div className="text-[10px] text-muted-foreground truncate">{skill.description}</div>}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">{selectedSkills.size} skill{selectedSkills.size !== 1 ? 's' : ''} selected</p>
            </div>
          )}

          {/* Step 3: Model + Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Primary Model (optional)</label>
                <div className="relative">
                  <select
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    className="w-full appearance-none bg-muted/20 border border-border rounded-lg px-4 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">Use gateway default</option>
                    {catalogModels.map(m => (
                      <option key={m.id} value={m.id}>{m.label || m.id}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Summary</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{emoji}</span>
                  <div>
                    <p className="font-semibold text-sm">{name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{agentId}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSkills.size === 0
                    ? <span className="text-[10px] bg-muted/50 px-2 py-0.5 rounded-full text-muted-foreground">All skills</span>
                    : Array.from(selectedSkills).map(s => (
                      <span key={s} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{s}</span>
                    ))
                  }
                </div>
                {model && <p className="text-[11px] font-mono text-muted-foreground">Model: {model}</p>}
              </div>

              {error && <ErrorCard msg={error} />}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step > 1 ? setStep(s => (s - 1) as 1 | 2 | 3) : onClose()}
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </Button>
          {step < 3 ? (
            <Button
              size="sm"
              disabled={step === 1 && !canNext1}
              onClick={() => setStep(s => (s + 1) as 1 | 2 | 3)}
              className="gap-1.5"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleCreate} disabled={creating} className="gap-1.5" id="wizard-deploy-btn">
              {creating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating…</> : <><Sparkles className="w-3.5 h-3.5" />Deploy Agent</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Overview panel
// ─────────────────────────────────────────────────────
function OverviewPanel({ agent, defaultId, identity, identityLoading, onGoFiles, onModelChanged, onDeleted }: {
  agent: AgentRow
  defaultId: string
  identity: AgentIdentity | null
  identityLoading: boolean
  onGoFiles: () => void
  onModelChanged: (model: string) => void
  onDeleted: () => void
}) {
  const [models, setModels] = useState<ModelEntry[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [selectedModel, setSelectedModel] = useState(agent.model ?? '')
  const [saving, setSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Sync when agent changes
  useEffect(() => { setSelectedModel(agent.model ?? '') }, [agent.id, agent.model])

  const [modelsErrorDetails, setModelsErrorDetails] = useState<string[] | null>(null)

  // Load model catalog
  useEffect(() => {
    setModelsLoading(true)
    setModelsErrorDetails(null)
    fetch('/api/providers/catalog')
      .then(r => r.ok ? r.json() : null)
      .then(d => { 
        if (d?.models) setModels(d.models as ModelEntry[]) 
        if (d?.details && Array.isArray(d.details)) setModelsErrorDetails(d.details)
      })
      .catch(() => {})
      .finally(() => setModelsLoading(false))
  }, [])

  const isDirty = selectedModel !== (agent.model ?? '')
  const isMain = agent.id === 'main' || agent.id === defaultId

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete the agent "${agent.id}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      onDeleted()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete agent')
      setDeleting(false)
    }
  }

  const handleSaveModel = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/agents/${agent.id}/set-model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; hint?: string; attempts?: unknown[] }
      if (!res.ok || !data.ok) {
        const msg = data.error || `HTTP ${res.status}`
        throw new Error(msg)
      }
      onModelChanged(selectedModel)
      setSaveFeedback('saved')
      setTimeout(() => setSaveFeedback('idle'), 2500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save model')
      setSaveFeedback('error')
      setTimeout(() => setSaveFeedback('idle'), 8000)
    } finally { setSaving(false) }
  }

  // Group models by provider for the optgroup display
  const byProvider = models.reduce<Record<string, ModelEntry[]>>((acc, m) => {
    const p = m.provider ?? m.id.split('/')[0] ?? 'other'
    ;(acc[p] ??= []).push(m)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {/* Info grid */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div><h3 className="font-semibold text-base">Overview</h3><p className="text-xs text-muted-foreground mt-0.5">Workspace paths and identity metadata.</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Workspace', value: (<button onClick={onGoFiles} className="font-mono text-xs text-primary hover:underline text-left break-all">{agent.workspace || 'default'}</button>) },
            { label: 'Current Model', value: <span className="font-mono text-xs">{agent.model || <span className="text-muted-foreground">not set</span>}</span> },
            { label: 'Agent ID', value: <span className="font-mono text-xs">{agent.id}</span> },
            { label: 'Identity Name', value: <span className="text-xs font-semibold">{identity?.name || agent.identityName || '—'}</span> },
            { label: 'Identity Avatar', value: <span className="text-xl">{identity?.emoji || agent.identityEmoji || '—'}</span> },
            { label: 'Default Agent', value: <span className="text-xs">{agent.id === defaultId ? '⭐ Yes' : 'No'}</span> },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/30 border border-border/60 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
              {value}
            </div>
          ))}
        </div>
      </div>

      {/* Model selection */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-base">Model Selection</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Override the primary model for this agent.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Primary model (default)</label>
            {modelsLoading ? (
              <div className="flex items-center gap-2 h-10 px-4 bg-muted/20 border border-border rounded-lg">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading models from OpenClaw…</span>
              </div>
            ) : models.length === 0 ? (
              <div className="rounded-lg bg-muted/20 border border-border/50 px-4 py-3 text-xs text-muted-foreground whitespace-pre-wrap">
                No models returned from OpenClaw CLI. Ensure the gateway is running and providers are configured.
                {agent.model && (
                  <span className="block mt-1 font-mono text-foreground/70">Current: {agent.model}</span>
                )}
                {modelsErrorDetails && modelsErrorDetails.length > 0 && (
                  <div className="mt-3 p-2 bg-destructive/10 text-destructive/80 font-mono text-[10px] rounded space-y-1 overflow-x-auto">
                    {modelsErrorDetails.map((err, i) => <div key={i}>{String(err).substring(0, 500)}</div>)}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <select
                      value={selectedModel}
                      onChange={e => setSelectedModel(e.target.value)}
                      className="w-full appearance-none bg-muted/20 border border-border rounded-lg px-4 py-2.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="">Not set (use gateway default)</option>
                      {Object.entries(byProvider).map(([provider, provModels]) => (
                        <optgroup key={provider} label={provider}>
                          {provModels.map(m => (
                            <option key={m.id} value={m.id}>{m.label || m.id}</option>
                          ))}
                        </optgroup>
                      ))}
                      {agent.model && !models.find(m => m.id === agent.model) && (
                        <option value={agent.model}>{agent.model} (current)</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={saving || !isDirty}
                      onClick={handleSaveModel}
                      className="gap-1.5 whitespace-nowrap"
                    >
                      {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</> : <>Save</>}
                    </Button>
                    {saveFeedback === 'saved' && (
                      <span className="text-xs text-emerald-500 whitespace-nowrap">✓ Saved</span>
                    )}
                  </div>
                </div>
                {saveFeedback === 'error' && saveError && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive font-mono leading-relaxed break-all">
                    {saveError}
                  </div>
                )}
              </div>
            )}
            {selectedModel && models.length > 0 && (
              <p className="text-[11px] font-mono text-muted-foreground mt-1.5">{selectedModel}</p>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-base text-destructive">Danger Zone</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Permanent destructive actions.</p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-foreground">Delete Agent</div>
            <div className="text-xs text-muted-foreground mt-0.5 max-w-sm">
              {isMain ? 'The main orchestrator agent cannot be deleted.' : 'Permanently remove this agent and all of its files from the workspace.'}
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isMain || deleting}
            className="gap-1.5"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Agent'}
          </Button>
        </div>  
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────────────
// Files panel
// ─────────────────────────────────────────────────────
function FilesPanel({ agent, isActive }: { agent: AgentRow; isActive: boolean }) {
  const [hasViewed, setHasViewed] = useState(false)
  const [filesList, setFilesList] = useState<AgentsFilesListResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [contents, setContents] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saved' | 'error'>('idle')
  const [preview, setPreview] = useState(true)

  useEffect(() => {
    if (isActive && !hasViewed) setHasViewed(true)
  }, [isActive, hasViewed])

  const loadFiles = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const q = agent.workspace ? `?workspace=${encodeURIComponent(agent.workspace)}` : ''
      const res = await fetch(`/api/agents/${agent.id}/files${q}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as AgentsFilesListResult
      setFilesList(data)
      if (data.files.length > 0 && !activeFile) setActiveFile(data.files[0].name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load files')
    } finally { setLoading(false) }
  }, [agent.id, agent.workspace, activeFile])

  useEffect(() => {
    if (hasViewed) loadFiles()
  }, [agent.id, hasViewed]) // eslint-disable-line

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

  useEffect(() => { if (activeFile) loadFileContent(activeFile) }, [activeFile, loadFileContent])

  const files = filesList?.files ?? []
  const currentContent = activeFile ? (contents[activeFile] ?? '') : ''
  const currentDraft = activeFile ? (drafts[activeFile] ?? currentContent) : ''
  const isDirty = activeFile ? currentDraft !== currentContent : false
  const isLoadingActive = activeFile ? (contents[activeFile] === undefined) : false

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
      setSaveFeedback('saved'); setTimeout(() => setSaveFeedback('idle'), 2500)
    } catch {
      setSaveFeedback('error'); setTimeout(() => setSaveFeedback('idle'), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div><h3 className="font-semibold text-base">Core Files</h3><p className="text-xs text-muted-foreground mt-0.5">Bootstrap persona, identity, and tool guidance.</p></div>
        <Button size="sm" variant="outline" onClick={loadFiles} disabled={loading} className="gap-1.5 h-8">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />{loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      {filesList && <p className="text-xs font-mono text-muted-foreground">Workspace: {filesList.workspace}</p>}
      {error && <ErrorCard msg={error} />}
      {files.length > 0 && (
        <>
          <div className="flex gap-1 flex-wrap border-b border-border pb-0">
            {files.map(file => {
              const label = file.name.replace(/\.md$/i, '')
              const isActive = activeFile === file.name
              return (
                <button key={file.name} onClick={() => { setActiveFile(file.name); setPreview(true) }}
                  className={cn('px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                    isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                    file.missing && 'opacity-60'
                  )}>
                  {label}{file.missing && <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-600 px-1 rounded">missing</span>}
                </button>
              )
            })}
          </div>
          {activeFile && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <code className="text-[11px] text-muted-foreground font-mono">{files.find(f => f.name === activeFile)?.path}</code>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs transition-all', saveFeedback === 'saved' ? 'text-emerald-500' : saveFeedback === 'error' ? 'text-destructive' : 'text-transparent')}>
                    {saveFeedback === 'saved' ? '✓ Saved' : saveFeedback === 'error' ? '⚠ Error' : '·'}
                  </span>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setPreview(v => !v)}>
                    {preview ? <Edit className="w-3 h-3" /> : <Eye className="w-3 h-3" />}{preview ? 'Edit' : 'Preview'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!isDirty}
                    onClick={() => setDrafts(prev => { const n = { ...prev }; delete n[activeFile!]; return n })}>Reset</Button>
                  <Button size="sm" className="h-7 text-xs gap-1" disabled={saving || !isDirty} onClick={handleSave}>
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}Save
                  </Button>
                </div>
              </div>
              {isLoadingActive ? (
                <div className="border border-border rounded-lg p-4 min-h-[360px] animate-pulse bg-muted/20 flex flex-col gap-3">
                  <div className="w-1/3 h-5 bg-muted rounded"></div>
                  <div className="w-3/4 h-4 bg-muted rounded opacity-70"></div>
                  <div className="w-2/3 h-4 bg-muted rounded opacity-70"></div>
                </div>
              ) : preview
                ? <div className="border border-border rounded-lg p-4 min-h-[360px] prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap font-mono">{currentDraft || <span className="text-muted-foreground italic">Empty file</span>}</div>
                : <textarea className="w-full min-h-[360px] bg-muted/20 border border-border rounded-lg p-4 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y leading-relaxed"
                    value={currentDraft} onChange={e => setDrafts(prev => ({ ...prev, [activeFile!]: e.target.value }))}
                    spellCheck={false} placeholder={files.find(f => f.name === activeFile)?.missing ? 'File missing — saving will create it.' : ''} />
              }
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Channels panel
// ─────────────────────────────────────────────────────
function ChannelsPanel({ agentId, isActive }: { agentId: string; isActive: boolean }) {
  const [hasViewed, setHasViewed] = useState(false)
  const [snapshot, setSnapshot] = useState<ChannelsStatusSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSuccess, setLastSuccess] = useState<number | null>(null)

  useEffect(() => {
    if (isActive && !hasViewed) setHasViewed(true)
  }, [isActive, hasViewed])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/agents/channels')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as ChannelsStatusSnapshot & { error?: string }
      if (data.error) setError(data.error)
      else { setSnapshot(data); setLastSuccess(Date.now()) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load channels')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { 
    if (hasViewed) load() 
  }, [hasViewed, load])

  const channelIds = snapshot ? [...new Set([...(snapshot.channelOrder ?? []), ...Object.keys(snapshot.channelAccounts ?? {})])] : []

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div><h3 className="font-semibold text-base">Channels</h3><p className="text-xs text-muted-foreground mt-0.5">Gateway-wide channel status snapshot.{lastSuccess && <span className="ml-1">Last: {relativeTime(lastSuccess)}</span>}</p></div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 h-8">
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />{loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
      {error && <ErrorCard msg={error} />}
      {loading && !snapshot && <LoadingCard label="Loading channels…" />}
      {channelIds.map(id => {
        const accounts = snapshot!.channelAccounts?.[id] ?? []
        const label = snapshot!.channelLabels?.[id] ?? id
        const connected = accounts.filter(a => a.connected || a.running).length
        const configured = accounts.filter(a => a.configured).length
        const enabled = accounts.filter(a => a.enabled).length
        const status = accounts.length ? `${connected}/${accounts.length} connected` : 'no accounts'
        return (
          <div key={id} className="flex items-center justify-between gap-3 py-3 px-4 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
            <div><div className="text-sm font-medium">{label}</div><div className="text-xs font-mono text-muted-foreground">{id}</div></div>
            <div className="text-right space-y-0.5">
              <div className={cn('text-xs font-medium', connected > 0 ? 'text-emerald-500' : 'text-muted-foreground')}>{status}</div>
              <div className="text-xs text-muted-foreground">{configured} configured · {enabled} enabled</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────
const TABS: Array<{ id: AgentsPanel; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'files', label: 'Files', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'channels', label: 'Channels', icon: <Radio className="w-3.5 h-3.5" /> },
]

export default function AgentsClient() {
  const [result, setResult] = useState<AgentsListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, _setSelectedId] = useState<string | null>(null)
  const [panel, _setPanel] = useState<AgentsPanel>('overview')

  // Setup persistence
  useEffect(() => {
    const id = sessionStorage.getItem('clawpanel_agent_id')
    const p = sessionStorage.getItem('clawpanel_agent_panel') as AgentsPanel
    if (id) _setSelectedId(id)
    if (p) _setPanel(p)
  }, [])

  const setSelectedId = (id: string | null) => {
    _setSelectedId(id)
    if (id) sessionStorage.setItem('clawpanel_agent_id', id)
    else sessionStorage.removeItem('clawpanel_agent_id')
  }

  const setPanel = (p: AgentsPanel) => {
    _setPanel(p)
    sessionStorage.setItem('clawpanel_agent_panel', p)
  }

  const [identity, setIdentity] = useState<AgentIdentity | null>(null)
  const [identityLoading, setIdentityLoading] = useState(false)
  const [settingDefault, setSettingDefault] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [skills, setSkills] = useState<SkillEntry[]>([])
  const [channelsSnapshot, setChannelsSnapshot] = useState<ChannelsStatusSnapshot | null>(null)

  const loadAgents = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as AgentsListResult
      setResult(data)
      const cached = sessionStorage.getItem('clawpanel_agent_id')
      if (!selectedId && !cached && data.agents.length > 0) {
        setSelectedId(data.defaultId ?? data.agents[0].id)
      } else if (cached && !selectedId) {
        // Just in case the effect hasn't run yet or we want to eagerly set it
        _setSelectedId(cached) 
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally { setLoading(false) }
  }, [selectedId])

  useEffect(() => { loadAgents() }, []) // eslint-disable-line

  // Load skills for the wizard
  useEffect(() => {
    fetch('/api/skills').then(r => r.ok ? r.json() : null).then(data => {
      if (Array.isArray(data?.skills)) setSkills(data.skills)
      else if (Array.isArray(data)) setSkills(data)
    }).catch(() => {})
  }, [])

  // Load channels for status dots on agent cards
  useEffect(() => {
    fetch('/api/agents/channels').then(r => r.ok ? r.json() : null).then(data => {
      if (data) setChannelsSnapshot(data as ChannelsStatusSnapshot)
    }).catch(() => {})
  }, [])

  const agents = result?.agents ?? []
  const defaultId = result?.defaultId ?? ''
  const selectedAgent = selectedId ? agents.find(a => a.id === selectedId) ?? null : null

  // Load identity when agent changes
  useEffect(() => {
    if (!selectedAgent) return
    setIdentity(null); setIdentityLoading(true)
    const q = selectedAgent.workspace ? `?workspace=${encodeURIComponent(selectedAgent.workspace)}` : ''
    fetch(`/api/agents/${selectedAgent.id}/identity${q}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setIdentity(d as AgentIdentity | null))
      .catch(() => setIdentity(null))
      .finally(() => setIdentityLoading(false))
  }, [selectedAgent?.id]) // eslint-disable-line

  const handleSetDefault = async (agentId: string) => {
    setSettingDefault(agentId)
    try {
      const res = await fetch(`/api/agents/${agentId}/set-default`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await loadAgents()
    } catch (e) {
      alert(`Failed to set default: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally { setSettingDefault(null) }
  }

  // Count connected channels per agent (gateway-wide for now)
  const connectedChannelCount = channelsSnapshot
    ? Object.values(channelsSnapshot.channelAccounts ?? {}).reduce((total, accounts) => {
        return total + accounts.filter(a => a.connected || a.running).length
      }, 0)
    : 0

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 pt-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your agent roster and workspace configurations.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadAgents} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />{loading ? 'Loading…' : 'Refresh'}
          </Button>
          <Button size="sm" onClick={() => setShowWizard(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />New Agent
          </Button>
        </div>
      </div>

      {error && <ErrorCard msg={error} />}

      {/* Agent Roster Grid */}
      {loading && agents.length === 0
        ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border bg-card p-4 animate-pulse h-44">
                <div className="flex gap-3 mb-3"><div className="w-10 h-10 bg-muted/60 rounded-xl" /><div className="flex-1 space-y-2"><div className="h-3 bg-muted/60 rounded w-2/3" /><div className="h-2 bg-muted/40 rounded w-1/2" /></div></div>
                <div className="space-y-2"><div className="h-2 bg-muted/40 rounded" /><div className="h-2 bg-muted/40 rounded w-3/4" /></div>
              </div>
            ))}
          </div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                defaultId={defaultId}
                isSelected={selectedId === agent.id}
                channelConnected={selectedId === agent.id ? connectedChannelCount : 0}
                onSelect={() => { setSelectedId(agent.id); setPanel('overview') }}
                onSetDefault={() => handleSetDefault(agent.id)}
                settingDefault={settingDefault === agent.id}
              />
            ))}
            {/* Empty state */}
            {agents.length === 0 && !loading && (
              <div className="col-span-3 rounded-xl border border-dashed border-border bg-muted/10 p-12 text-center">
                <Bot className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No agents found.</p>
                <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowWizard(true)}>
                  <Plus className="w-3.5 h-3.5" />Create First Agent
                </Button>
              </div>
            )}
          </div>
      }

      {/* Detail panel */}
      {selectedAgent && (
        <div key={selectedAgent.id} className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-base">{selectedAgent.identityEmoji || '🤖'}</span>
            <h2 className="font-semibold text-lg">{selectedAgent.identityName || selectedAgent.name || selectedAgent.id}</h2>
            {selectedAgent.id === defaultId && (
              <span className="text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                <Star className="w-2.5 h-2.5 fill-current" />Default
              </span>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex gap-0.5 border-b border-border overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setPanel(tab.id)}
                className={cn('flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                  panel === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          <div className={panel === 'overview' ? 'block' : 'hidden'}>
            <OverviewPanel
              key={selectedAgent.id}
              agent={selectedAgent}
              defaultId={defaultId}
              identity={identity}
              identityLoading={identityLoading}
              onGoFiles={() => setPanel('files')}
              onModelChanged={(model) => {
                // Optimistically update local agent model display
                setResult(prev => prev ? {
                  ...prev,
                  agents: prev.agents.map(a => a.id === selectedAgent.id ? { ...a, model } : a)
                } : prev)
              }}
              onDeleted={() => {
                setSelectedId(null)
                loadAgents()
              }}
            />
          </div>
          <div className={panel === 'files' ? 'block' : 'hidden'}>
            <FilesPanel key={selectedAgent.id} agent={selectedAgent} isActive={panel === 'files'} />
          </div>
          <div className={panel === 'channels' ? 'block' : 'hidden'}>
            <ChannelsPanel key={selectedAgent.id} agentId={selectedAgent.id} isActive={panel === 'channels'} />
          </div>
        </div>
      )}

      {/* Create Agent Wizard */}
      {showWizard && (
        <CreateAgentWizard
          skills={skills}
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); loadAgents() }}
        />
      )}
    </div>
  )
}
