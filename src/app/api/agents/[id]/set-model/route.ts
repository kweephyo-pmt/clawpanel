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

  try {
    // Write the model to openclaw config (agents.defaults.model.primary)
    execFileSync(bin, ['models', 'set', modelId], { encoding: 'utf-8', timeout: 15000 })

    // Hot-reload the gateway so the change takes effect immediately without restart.
    // agents.defaults.model is a hot-reload path — fire-and-forget.
    try { execFileSync(bin, ['config', 'reload'], { encoding: 'utf-8', timeout: 5000 }) } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true, agentId: id, model: modelId })
  } catch (err) {
    return apiErrorResponse(err, `Failed to set model to "${modelId}"`)
  }
}
