import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

// POST /api/agents/[id]/set-model  { model: "provider/model-id" }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bin = requireEnv('OPENCLAW_BIN')

  const body = await req.json() as { model?: string }
  const model = (body.model ?? '').trim()

  function run(args: string[]): { ok: boolean; output?: string; error?: string } {
    try {
      const out = execFileSync(bin, args, { encoding: 'utf-8', timeout: 10000 })
      return { ok: true, output: out.trim() }
    } catch (e: any) {
      const msg = (e.stderr || e.stdout || e.message || String(e)).trim()
      return { ok: false, error: msg }
    }
  }

  // ── Clear model ──────────────────────────────────────────────────────────────
  if (!model) {
    const r = run(['config', 'unset', `agents.entries.${id}.model`])
    if (r.ok) return NextResponse.json({ ok: true, agentId: id, model: null })
    // fallback: set to empty string
    const r2 = run(['config', 'set', `agents.entries.${id}.model`, ''])
    if (r2.ok) return NextResponse.json({ ok: true, agentId: id, model: null })
    return NextResponse.json({ error: r2.error ?? r.error ?? 'Could not clear model' }, { status: 500 })
  }

  // ── Set model ────────────────────────────────────────────────────────────────
  // Use execFileSync with args array (same pattern as crons/add) — no shell quoting needed,
  // so slashes and dots in model ids (e.g. "anthropic/claude-3-5-sonnet") pass through safely.

  const r1 = run(['config', 'set', `agents.entries.${id}.model`, model])

  if (id === 'main') {
    // Also update the top-level primary model for the main agent
    run(['config', 'set', 'model.primary', model])
    run(['models', 'set', model])
  }

  if (r1.ok) {
    return NextResponse.json({ ok: true, agentId: id, model, source: 'cli' })
  }

  return NextResponse.json(
    {
      error: r1.error ?? 'Failed to set model',
      hint: 'Check that OPENCLAW_BIN is correct and the openclaw CLI is functional.',
    },
    { status: 500 }
  )
}
