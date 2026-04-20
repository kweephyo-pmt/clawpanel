import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

// POST /api/agents/[id]/set-model  { model: "provider/model-id" }
//
// OpenClaw resolves an agent's model in priority order:
//   1. agents.list[].model  (per-agent override)  — always wins
//   2. agents.defaults.model.primary              — global default
//
// `openclaw models set` only updates #2. If a per-agent override exists
// this route must also update #1, otherwise the change is invisible.
//
// There is no high-level CLI for updating a per-agent model, so we:
//   1. Read the config file to find the agent's list index
//   2. Update agents.list[idx].model via `config set`
//   3. Always also update agents.defaults.model.primary via `models set`
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bin = requireEnv('OPENCLAW_BIN')
  const { model } = await req.json() as { model?: string }
  const modelId = model?.trim() ?? ''

  if (!modelId) {
    return NextResponse.json({ error: 'model is required' }, { status: 400 })
  }

  try {
    // ── Step 1: Update per-agent model override (agents.list[idx].model) ──────
    // Read current config to find the agent's array index
    let agentIndex = -1
    try {
      const raw = execFileSync(bin, ['config', 'show', '--json'], {
        encoding: 'utf-8',
        timeout: 10000,
      })
      const cfg = JSON.parse(raw) as {
        agents?: { list?: Array<{ id: string; model?: unknown }> }
      }
      const list = cfg.agents?.list ?? []
      agentIndex = list.findIndex(
        (entry) => entry.id?.toLowerCase() === id.toLowerCase()
      )
    } catch {
      // If config read fails, fall through to global default update only
    }

    if (agentIndex >= 0) {
      // Update the per-agent model so it takes priority correctly
      execFileSync(
        bin,
        ['config', 'set', `agents.list[${agentIndex}].model`, modelId],
        { encoding: 'utf-8', timeout: 10000 }
      )
    }

    // ── Step 2: Update global default (agents.defaults.model.primary) ─────────
    execFileSync(bin, ['models', 'set', modelId], {
      encoding: 'utf-8',
      timeout: 15000,
    })

    return NextResponse.json({ ok: true, agentId: id, model: modelId, agentIndex })
  } catch (err) {
    return apiErrorResponse(err, `Failed to set model to "${modelId}"`)
  }
}
