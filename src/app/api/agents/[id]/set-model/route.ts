import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

// POST /api/agents/[id]/set-model  { model: "provider/model-id" }
//
// OpenClaw has no per-agent model config path via `config set`.
// The primary model is stored in agents.defaults.model and is set
// via `openclaw models set <model>` — same as the Control UI does.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bin = requireEnv('OPENCLAW_BIN')

  const body = await req.json() as { model?: string }
  const model = (body.model ?? '').trim()

  if (!model) {
    return NextResponse.json(
      { error: 'Clearing the model is not supported — select a model from the list.' },
      { status: 400 }
    )
  }

  try {
    // `openclaw models set <model>` writes agents.defaults.model.primary into config.
    // Uses execFileSync with args array (same pattern as crons/add) so slashes and
    // dots in model ids like "anthropic/claude-opus-4-5" pass through safely.
    const output = execFileSync(bin, ['models', 'set', model], {
      encoding: 'utf-8',
      timeout: 15000,
    })

    return NextResponse.json({ ok: true, agentId: id, model, output: output.trim() })
  } catch (err) {
    return apiErrorResponse(err, `Failed to set model to "${model}"`)
  }
}
