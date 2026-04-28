'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw, FileText, Radio, LayoutDashboard,
  Loader2, AlertTriangle, Eye, Edit, X, Plus, Star,
  CheckCircle2, Zap, Bot, Sparkles,
  Check, ChevronRight, Search, Cpu, ArrowRight,
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

type AgentFileEntry = { name: string; path: string; missing: boolean; content?: string; size?: number }
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

type SkillEntry = { id: string; name: string; description?: string; emoji?: string; enabled?: boolean; source?: string }

type AgentIdentity = { name: string; avatar: string; emoji?: string }
type AgentsPanel = 'overview' | 'files' | 'skills' | 'channels'



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
  agent, defaultId, isSelected, channelConnected, onSelect,
}: {
  agent: AgentRow
  defaultId: string
  isSelected: boolean
  channelConnected: number
  onSelect: () => void
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
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Create Agent Wizard
// ─────────────────────────────────────────────────────
// Quick emoji suggestions per role type
const EMOJI_SUGGESTIONS: Record<string, string[]> = {
  seo:     ['🔍','📈','🏆','📊','🎯'],
  sales:   ['💼','🤝','💰','📞','🚀'],
  content: ['✍️','📝','🖊️','📰','💡'],
  data:    ['📊','🔢','🧮','📉','⚙️'],
  email:   ['📧','📬','✉️','📨','💌'],
  social:  ['📱','🌐','💬','🔗','📣'],
  default: ['🤖','⚡','🧠','🦾','🌟'],
}

function getEmojiSuggestions(name: string, description: string): string[] {
  const text = (name + ' ' + description).toLowerCase()
  for (const [key, emojis] of Object.entries(EMOJI_SUGGESTIONS)) {
    if (text.includes(key)) return emojis
  }
  return EMOJI_SUGGESTIONS.default
}

// STEP LABELS
const STEPS = [
  { id: 1, label: 'Identity', icon: Bot },
  { id: 2, label: 'Skills',   icon: Zap },
  { id: 3, label: 'Deploy',   icon: Sparkles },
]

function CreateAgentWizard({
  skills,
  onClose,
  onCreated,
}: {
  skills: SkillEntry[]
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep]               = useState<1|2|3>(1)
  const [name, setName]               = useState('')
  const [emoji, setEmoji]             = useState('🤖')
  const [description, setDescription] = useState('')
  const [model, setModel]             = useState('')
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramAllowFrom, setTelegramAllowFrom] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [skillSearch, setSkillSearch] = useState('')
  const [skillSource, setSkillSource] = useState<'all'|'workspace'|'bundled'>('all')
  const [creating, setCreating]       = useState(false)
  const [error, setError]             = useState<string|null>(null)
  const [deployed, setDeployed]       = useState(false)

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const agentId = slugify(name) || 'new-agent'

  const toggleSkill = (id: string) => {
    setSelectedSkills(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filteredSkills = useMemo(() => {
    let list = skills
    if (skillSource === 'workspace') list = list.filter(s => s.source !== 'bundled')
    if (skillSource === 'bundled')   list = list.filter(s => s.source === 'bundled')
    const q = skillSearch.trim().toLowerCase()
    if (q) list = list.filter(s => (s.name + s.id + (s.description ?? '')).toLowerCase().includes(q))
    return list
  }, [skills, skillSearch, skillSource])

  const emojiSuggestions = useMemo(() => getEmojiSuggestions(name, description), [name, description])

  const handleCreate = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: agentId, name, emoji, description,
          model: model.trim() || undefined,
          skills: Array.from(selectedSkills),
          telegramToken: telegramToken.trim() || undefined,
          telegramAllowFrom: telegramAllowFrom.trim() || undefined,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDeployed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create agent')
    } finally {
      setCreating(false)
    }
  }

  const canNext1 = name.trim().length >= 2 && description.trim().length >= 10

  // ── Deployed success screen ────────────────────────────────────────────────
  if (deployed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
          <div className="px-8 py-10 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-3xl shadow-lg">
              {emoji}
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <p className="font-semibold text-base text-emerald-500">Agent Deployed</p>
              </div>
              <p className="text-xl font-bold">{name}</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">{agentId}</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{description}</p>
            {selectedSkills.size > 0 && (
              <div className="w-full rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Skill allowlist · {selectedSkills.size} skill{selectedSkills.size !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {Array.from(selectedSkills).map(s => (
                    <span key={s} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium border border-primary/20">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedSkills.size === 0 && (
              <p className="text-xs text-muted-foreground">Access to all global skills · no restriction</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Skill allowlist written to <code className="bg-muted/50 px-1 rounded">openclaw.json</code>.
              Fine-tune anytime in OpenClaw UI → Agents → Skills.
            </p>
            <Button className="w-full gap-2 mt-2" onClick={onCreated}>
              <ArrowRight className="w-4 h-4" />Go to Agent
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main wizard ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-base">New Agent</h2>
            {/* Step pills */}
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon
                const active = step === s.id
                const done   = step > s.id
                return (
                  <div key={s.id} className="flex items-center gap-1">
                    <div className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                      active ? 'bg-primary text-primary-foreground' :
                      done   ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' :
                               'bg-muted/50 text-muted-foreground'
                    )}>
                      {done ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                      {s.label}
                    </div>
                    {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                  </div>
                )
              })}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body: form left + preview right ── */}
        <div className="flex flex-1 min-h-0">

          {/* Left: form area */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ──── STEP 1: Identity ───────────────── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-semibold mb-1">Name & Persona</p>
                  <p className="text-xs text-muted-foreground mb-4">Give your agent an identity. The description becomes its SOUL.md — be specific about its role and boundaries.</p>

                  {/* Emoji + name row */}
                  <div className="flex gap-3 mb-2">
                    <div className="shrink-0">
                      <div className="w-14 h-14 rounded-xl bg-muted/30 border border-border flex items-center justify-center text-2xl mb-1.5 font-medium">
                        {emoji}
                      </div>
                      <input
                        type="text"
                        value={emoji}
                        onChange={e => setEmoji(e.target.value)}
                        className="w-14 text-center text-xs bg-muted/20 border border-border rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50"
                        maxLength={2}
                        placeholder="emoji"
                      />
                    </div>
                    <div className="flex-1 space-y-3">
                      <input
                        autoFocus
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Agent name (e.g. SEO Bot, Sales Agent)"
                        className="w-full h-11 px-4 text-sm bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium"
                      />
                      {name && <p className="text-[11px] text-muted-foreground font-mono">ID: {agentId}</p>}
                      {/* Quick emoji row */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground">Quick:</span>
                        {emojiSuggestions.map(e => (
                          <button key={e} onClick={() => setEmoji(e)}
                            className={cn('text-lg w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110',
                              emoji === e ? 'bg-primary/20 ring-1 ring-primary/40' : 'hover:bg-muted/50'
                            )}>{e}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Role & Responsibilities</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={`Describe what this agent does, its focus area, and what it should NOT do.\n\nExample: "You are a focused SEO specialist. Your primary responsibilities are keyword research, analyzing competitor content, auditing on-page SEO, and writing high-ranking blog posts. Do not take on sales or administrative tasks."`}
                    className="w-full h-32 px-4 py-3 text-sm bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-muted-foreground">{description.length} chars · min 10</p>
                    {description.length >= 10 && <p className="text-[10px] text-emerald-500">✓ Good</p>}
                  </div>
                </div>

                {/* Model (optional) */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Model override <span className="text-muted-foreground/60">(optional)</span></label>
                  <input
                    type="text"
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="e.g. openrouter/moonshotai/kimi-k2  (leave blank to use gateway default)"
                    className="w-full h-10 px-4 text-xs font-mono bg-muted/20 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            )}

            {/* ──── STEP 2: Skills ─────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-1">Skill Allowlist</p>
                  <p className="text-xs text-muted-foreground">Select which skills this agent can use. Leaving all unselected means it inherits the global skill set. Fewer skills = more focused agent.</p>
                </div>

                {/* Search + source filter */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      value={skillSearch}
                      onChange={e => setSkillSearch(e.target.value)}
                      placeholder="Search skills…"
                      className="w-full h-9 pl-9 pr-3 text-xs bg-muted/20 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {skillSearch && (
                      <button onClick={() => setSkillSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 bg-muted/30 p-1 rounded-lg border border-border/50">
                    {(['all','workspace','bundled'] as const).map(src => (
                      <button key={src} onClick={() => setSkillSource(src)}
                        className={cn('px-2.5 py-1 text-[11px] font-medium rounded-md transition-all capitalize',
                          skillSource === src ? 'bg-background shadow text-foreground border border-border/50' : 'text-muted-foreground hover:text-foreground'
                        )}>{src}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Count */}
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">{filteredSkills.length} shown · {selectedSkills.size} selected</p>
                  {selectedSkills.size > 0 && (
                    <button onClick={() => setSelectedSkills(new Set())} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">Clear all</button>
                  )}
                </div>

                {/* Skill list */}
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {filteredSkills.length === 0 && (
                    <p className="text-xs text-muted-foreground py-6 text-center">No skills found.</p>
                  )}
                  {filteredSkills.map(skill => {
                    const selected = selectedSkills.has(skill.id)
                    const isWorkspace = skill.source !== 'bundled'
                    return (
                      <button
                        key={skill.id}
                        onClick={() => toggleSkill(skill.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border group',
                          selected
                            ? 'bg-primary/8 border-primary/30 text-foreground shadow-sm'
                            : 'bg-muted/10 border-transparent hover:border-border/60 hover:bg-muted/25 text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {/* checkbox */}
                        <div className={cn(
                          'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all',
                          selected ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                        )}>
                          {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        {/* emoji */}
                        <span className="text-base shrink-0 w-6">{skill.emoji || '🔧'}</span>
                        {/* info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium">{skill.name || skill.id}</span>
                            {isWorkspace && (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium border border-emerald-500/20">custom</span>
                            )}
                          </div>
                          {skill.description && (
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5">{skill.description}</div>
                          )}
                        </div>
                        {/* source dot */}
                        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', isWorkspace ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ──── STEP 3: Review ─────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-1">Review & Deploy</p>
                  <p className="text-xs text-muted-foreground">Check the configuration below. Once deployed, the agent is registered in openclaw.json and the gateway reloads.</p>
                </div>

                <div className="space-y-3">
                  {/* Identity row */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Identity</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted/40 border border-border flex items-center justify-center text-xl">{emoji}</div>
                      <div>
                        <p className="font-semibold text-sm">{name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{agentId}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                    {model && (
                      <p className="text-[11px] font-mono text-muted-foreground">
                        <span className="text-muted-foreground/60">model:</span> {model}
                      </p>
                    )}
                  </div>

                  {/* Skills row */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {selectedSkills.size > 0 ? `Skill allowlist · ${selectedSkills.size}` : 'Skills'}
                    </p>
                    {selectedSkills.size === 0 ? (
                      <p className="text-xs text-muted-foreground">No restriction — agent inherits all global skills.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(selectedSkills).map(s => (
                          <span key={s} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium border border-primary/20">{s}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Written to <code className="bg-muted/50 px-1 rounded">agents.list[].skills</code> in openclaw.json.
                      Adjust anytime via OpenClaw UI → Agents → Skills tab.
                    </p>
                  </div>

                  {/* Channel row */}
                  <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Dedicated Telegram Channel</p>
                    <input
                      type="text"
                      value={telegramToken}
                      onChange={e => setTelegramToken(e.target.value)}
                      placeholder="Bot Token from BotFather (e.g. 123456:ABC-DEF...)"
                      className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <input
                      type="text"
                      value={telegramAllowFrom}
                      onChange={e => setTelegramAllowFrom(e.target.value)}
                      placeholder="Employee Telegram User ID (numeric, e.g. 8734062810)"
                      disabled={!telegramToken.trim()}
                      className="w-full h-9 px-3 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {telegramToken.trim() && telegramAllowFrom.trim()
                        ? '🔒 DM allowlist enabled — only this user can message the bot.'
                        : telegramToken.trim()
                        ? '⚠️ No User ID set — bot will use pairing mode (anyone can request access).'
                        : 'Leave both empty to skip Telegram setup.'}
                    </p>
                  </div>
                </div>

                {error && <ErrorCard msg={error} />}
              </div>
            )}
          </div>

          {/* Right: live preview */}
          <div className="w-56 shrink-0 border-l border-border bg-muted/20 p-4 flex flex-col gap-3 overflow-y-auto">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</p>

            {/* Agent card preview */}
            <div className="rounded-xl border border-border bg-card p-3 space-y-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-lg border border-border/60">
                  {emoji}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs truncate">{name || <span className="text-muted-foreground">Agent name</span>}</p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">{agentId}</p>
                </div>
              </div>
              {description && (
                <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-4">{description}</p>
              )}
              {selectedSkills.size > 0 && (
                <div className="pt-1.5 border-t border-border/50">
                  <p className="text-[9px] text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(selectedSkills).slice(0, 6).map(s => (
                      <span key={s} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">{s}</span>
                    ))}
                    {selectedSkills.size > 6 && (
                      <span className="text-[9px] text-muted-foreground">+{selectedSkills.size - 6} more</span>
                    )}
                  </div>
                </div>
              )}
              {model && (
                <div className="pt-1.5 border-t border-border/50">
                  <p className="text-[9px] text-muted-foreground font-mono truncate">{model}</p>
                </div>
              )}
            </div>

            {/* Config preview */}
            <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-[10px] font-mono text-muted-foreground space-y-0.5 leading-relaxed">
              <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-1.5">openclaw.json</p>
              <p><span className="text-sky-400">"id"</span>{': '}<span className="text-amber-400">"{agentId}"</span></p>
              {model && <p><span className="text-sky-400">"model"</span>{': ...'}</p>}
              {selectedSkills.size > 0 && (
                <p><span className="text-sky-400">"skills"</span>{': ['}<span className="text-emerald-400">{selectedSkills.size}</span>{']'}</p>
              )}
            </div>

            <div className="mt-auto space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className={cn('w-1.5 h-1.5 rounded-full', name.length >= 2 ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                Name set
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className={cn('w-1.5 h-1.5 rounded-full', description.length >= 10 ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                Description set
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <div className={cn('w-1.5 h-1.5 rounded-full', selectedSkills.size > 0 ? 'bg-primary' : 'bg-muted-foreground/30')} />
                {selectedSkills.size > 0 ? `${selectedSkills.size} skills` : 'No skill limit'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => step > 1 ? setStep(s => (s - 1) as 1|2|3) : onClose()}>
            {step === 1 ? 'Cancel' : '← Back'}
          </Button>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="text-muted-foreground">
                Skip
              </Button>
            )}
            {step < 3 ? (
              <Button size="sm" disabled={step === 1 && !canNext1} onClick={() => setStep(s => (s + 1) as 1|2|3)} className="gap-1.5">
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleCreate} disabled={creating} className="gap-1.5" id="wizard-deploy-btn">
                {creating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Deploying…</>
                  : <><Sparkles className="w-3.5 h-3.5" />Deploy Agent</>}
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Overview panel
// ─────────────────────────────────────────────────────
function OverviewPanel({ agent, defaultId, identity, identityLoading, onGoFiles, onDeleted }: {
  agent: AgentRow
  defaultId: string
  identity: AgentIdentity | null
  identityLoading: boolean
  onGoFiles: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)

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
            { label: 'Default Agent', value: <span className="text-xs">{agent.id === defaultId ? '⭐ Yes' : 'No'}</span> },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-muted/30 border border-border/60 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
              {value}
            </div>
          ))}
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
      // Pre-populate contents from the inline data — no individual file fetches needed
      const inlineContents: Record<string, string> = {}
      for (const f of data.files) {
        if (f.content !== undefined) inlineContents[f.name] = f.content
      }
      setContents(inlineContents)
      if (data.files.length > 0) setActiveFile(prev => prev ?? data.files[0].name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load files')
    } finally { setLoading(false) }
  }, [agent.id, agent.workspace])

  useEffect(() => {
    if (hasViewed) loadFiles()
  }, [agent.id, hasViewed]) // eslint-disable-line

  const files = filesList?.files ?? []
  const currentContent = activeFile ? (contents[activeFile] ?? '') : ''
  const currentDraft = activeFile ? (drafts[activeFile] ?? currentContent) : ''
  const isDirty = activeFile ? currentDraft !== currentContent : false
  const isLoadingActive = loading && activeFile ? (contents[activeFile] === undefined) : false

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
// Skills panel
// ─────────────────────────────────────────────────────
type AgentSkillEntry = {
  id: string
  name: string
  description?: string
  emoji?: string
  source?: string
  eligible?: boolean
  requiredBins?: string[]
}

function SkillsPanel({ agentId, isActive }: { agentId: string; isActive: boolean }) {
  const [hasViewed, setHasViewed]       = useState(false)
  const [allSkills, setAllSkills]       = useState<AgentSkillEntry[]>([])
  const [allowlist, setAllowlist]       = useState<Set<string> | null>(null) // null = unrestricted
  const [pending, setPending]           = useState<Set<string>>(new Set())
  const [loading, setLoading]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [saved, setSaved]               = useState(false)
  const [search, setSearch]             = useState('')
  const [dirty, setDirty]               = useState(false)

  useEffect(() => { if (isActive && !hasViewed) setHasViewed(true) }, [isActive, hasViewed])

  // Load skills for this agent
  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // All global skills
      const skillsRes = await fetch('/api/skills')
      const skillsData = skillsRes.ok ? await skillsRes.json() as AgentSkillEntry[] : []
      setAllSkills(skillsData)

      // Agent-specific allowlist from openclaw.json
      const agentRes = await fetch(`/api/agents/${agentId}`)
      if (agentRes.ok) {
        const agentData = await agentRes.json() as { skills?: string[] }
        if (Array.isArray(agentData.skills)) {
          const s = new Set(agentData.skills)
          setAllowlist(s)
          setPending(new Set(s))
        } else {
          setAllowlist(null)     // no restriction
          setPending(new Set())
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [agentId])

  useEffect(() => { if (hasViewed) load() }, [hasViewed, load])

  const isCustom = allowlist !== null
  const effectiveEnabled = (id: string) => isCustom ? pending.has(id) : true

  const toggle = (id: string) => {
    setPending(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setDirty(true)
  }

  const enableAll  = () => { setPending(new Set(allSkills.map(s => s.id))); setDirty(true) }
  const disableAll = () => { setPending(new Set()); setDirty(true) }
  const reset      = () => { setPending(allowlist ? new Set(allowlist) : new Set()); setDirty(false) }

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const skills = pending.size > 0 ? Array.from(pending) : null
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setAllowlist(skills ? new Set(skills) : null)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q
      ? allSkills.filter(s => (s.name + s.id + (s.description ?? '')).toLowerCase().includes(q))
      : allSkills
  }, [allSkills, search])

  const workspaceSkills = filtered.filter(s => s.source !== 'bundled')
  const bundledSkills   = filtered.filter(s => s.source === 'bundled')

  const enabledCount = isCustom
    ? allSkills.filter(s => pending.has(s.id)).length
    : allSkills.length

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-base">Skills</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per-agent skill allowlist and workspace skills. {enabledCount}/{allSkills.length}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={enableAll}>Enable All</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={disableAll}>Disable All</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={reset} disabled={!dirty}>Reset</Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={load} disabled={loading}>
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />Refresh
          </Button>
          <Button
            size="sm"
            className={cn('h-8 gap-1.5 text-xs', saved && 'bg-emerald-600 hover:bg-emerald-700')}
            onClick={save}
            disabled={saving || !dirty}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Allowlist notice */}
      {isCustom ? (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-2.5 text-xs text-primary">
          This agent uses a custom skill allowlist ({enabledCount} of {allSkills.length} enabled).
        </div>
      ) : (
        <div className="rounded-lg bg-muted/50 border border-border px-4 py-2.5 text-xs text-muted-foreground">
          This agent inherits all global skills. Select skills below and save to create a custom allowlist.
        </div>
      )}

      {error && <ErrorCard msg={error} />}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter skills…"
          className="w-full h-9 pl-9 pr-3 text-xs bg-muted/20 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading && !allSkills.length && <LoadingCard label="Loading skills…" />}

      {/* Skill groups */}
      {([{ label: 'Workspace Skills', skills: workspaceSkills }, { label: 'Built-in Skills', skills: bundledSkills }] as const).map(group => {
        if (group.skills.length === 0) return null
        return (
          <div key={group.label} className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
              {group.label} <span className="font-normal">· {group.skills.length}</span>
            </p>
            {group.skills.map(skill => {
              const enabled = effectiveEnabled(skill.id)
              const isWs    = skill.source !== 'bundled'
              return (
                <div
                  key={skill.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
                    enabled
                      ? 'bg-card border-border/60'
                      : 'bg-muted/20 border-transparent opacity-60'
                  )}
                >
                  {/* Status dot */}
                  <div className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    enabled
                      ? (skill.eligible !== false ? 'bg-emerald-500' : 'bg-amber-500')
                      : 'bg-muted-foreground/40'
                  )} />
                  {/* Emoji */}
                  <span className="text-sm shrink-0 w-5">{skill.emoji || '🔧'}</span>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium">{skill.name || skill.id}</span>
                      {isWs && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium">custom</span>
                      )}
                      {!isCustom && (
                        <span className="text-[9px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded font-medium">inherited</span>
                      )}
                    </div>
                    {skill.description && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{skill.description}</p>
                    )}
                    {skill.requiredBins && skill.requiredBins.length > 0 && (
                      <p className="text-[10px] text-amber-500 mt-0.5">Missing: {skill.requiredBins.join(', ')}</p>
                    )}
                  </div>
                  {/* Toggle */}
                  <button
                    onClick={() => toggle(skill.id)}
                    className={cn(
                      'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
                      enabled ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <span className={cn(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
                      enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}

      {!loading && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">No matching skills.</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────
const TABS: Array<{ id: AgentsPanel; label: string; icon: React.ReactNode }> = [
  { id: 'overview',  label: 'Overview',  icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'files',     label: 'Files',     icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'skills',    label: 'Skills',    icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'channels',  label: 'Channels',  icon: <Radio className="w-3.5 h-3.5" /> },
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
                channelConnected={connectedChannelCount}
                onSelect={() => { setSelectedId(agent.id); setPanel('overview') }}
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
              onDeleted={() => {
                setSelectedId(null)
                loadAgents()
              }}
            />
          </div>
          <div className={panel === 'files' ? 'block' : 'hidden'}>
            <FilesPanel key={selectedAgent.id} agent={selectedAgent} isActive={panel === 'files'} />
          </div>
          <div className={panel === 'skills' ? 'block' : 'hidden'}>
            <SkillsPanel key={selectedAgent.id} agentId={selectedAgent.id} isActive={panel === 'skills'} />
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
