import { NextResponse } from 'next/server'
import { execFileSync } from 'child_process'
import { requireEnv } from '@/lib/env'
import { apiErrorResponse } from '@/lib/api-error'

// POST /api/agents/[id]/set-model  { model: "provider/model-id" }
//
// `openclaw models set <model>` writes agents.defaults.model.primary to
// the config file. We then call `config reload` so the running gateway
// picks up the change immediately — same pattern as the agent delete route.
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
    // 1. Write the new model to openclaw config
    const output = execFileSync(bin, ['models', 'set', model], {
      encoding: 'utf-8',
      timeout: 15000,
    })

    // 2. Signal the running gateway to hot-reload the config.
    //    agents.defaults.model is a hot-reload path — no gateway restart needed.
    //    Fire-and-forget: if reload fails the write still succeeded.
    try {
      execFileSync(bin, ['config', 'reload'], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: 'ignore',
      } as Parameters<typeof execFileSync>[2])
    } catch {
      // Non-fatal — gateway will pick up the change on next restart
    }

    return NextResponse.json({ ok: true, agentId: id, model, output: output.trim() })
  } catch (err) {
    return apiErrorResponse(err, `Failed to set model to "${model}"`)
  }
}
