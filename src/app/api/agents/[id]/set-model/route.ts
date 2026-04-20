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
  const { model } = await req.json() as { model?: string }
  const modelId = model?.trim() ?? ''

  if (!modelId) {
    return NextResponse.json({ error: 'model is required' }, { status: 400 })
  }

  const debug: Record<string, unknown> = { agentId: id, model: modelId }

  // ── Step 1: Read config to find per-agent list index ─────────────────────────
  let agentIndex = -1
  try {
    const raw = execFileSync(bin, ['config', 'show', '--json'], {
      encoding: 'utf-8',
      timeout: 10000,
    })
    const cfg = JSON.parse(raw) as {
      agents?: { list?: Array<{ id: string }> }
    }
    const list = cfg.agents?.list ?? []
    agentIndex = list.findIndex(
      (entry) => entry.id?.toLowerCase() === id.toLowerCase()
    )
    debug.agentListLength = list.length
    debug.agentIndex = agentIndex
  } catch (e: unknown) {
    debug.configShowError = String(e)
  }

  // ── Step 2: Update per-agent model override (highest priority) ────────────────
  if (agentIndex >= 0) {
    try {
      const out = execFileSync(
        bin,
        ['config', 'set', `agents.list[${agentIndex}].model`, modelId],
        { encoding: 'utf-8', timeout: 10000 }
      )
      debug.perAgentSetOk = true
      debug.perAgentSetOutput = out.trim()
    } catch (e: unknown) {
      debug.perAgentSetOk = false
      debug.perAgentSetError = String(e)
    }
  } else {
    debug.perAgentSetSkipped = 'agent not found in agents.list'
  }

  // ── Step 3: Update global default (fallback for agents without per-agent entry)
  try {
    const out = execFileSync(bin, ['models', 'set', modelId], {
      encoding: 'utf-8',
      timeout: 15000,
    })
    debug.modelsSetOk = true
    debug.modelsSetOutput = out.trim()
  } catch (e: unknown) {
    debug.modelsSetOk = false
    debug.modelsSetError = String(e)
    // If models set also fails, nothing was written — surface the error
    return NextResponse.json(
      { error: debug.modelsSetError, debug },
      { status: 500 }
    )
  }

  // Return ok even if per-agent step failed — debug field will tell us why
  const ok = agentIndex < 0 || debug.perAgentSetOk === true
  return NextResponse.json({ ok, debug })
}
