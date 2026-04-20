import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

// POST /api/agents/[id]/set-model  { model: "provider/model-id" }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bin = process.env.OPENCLAW_BIN
  if (!bin) {
    return NextResponse.json({ error: 'OPENCLAW_BIN not set' }, { status: 503 })
  }

  try {
    const body = await req.json() as { model?: string }
    const model = body.model ?? ''

    if (!model) {
      // Clear model (reset to default)
      try {
        execSync(`${bin} config unset agents.entries.${id}.model`, {
          encoding: 'utf-8', timeout: 10000,
        })
      } catch {
        // command may not exist — try setting to empty string
        execSync(`${bin} config set agents.entries.${id}.model ""`, {
          encoding: 'utf-8', timeout: 10000,
        })
      }
      return NextResponse.json({ ok: true, agentId: id, model: null })
    }

    // Try primary: openclaw config set agents.entries.<id>.model <model>
    try {
      execSync(`${bin} config set agents.entries.${id}.model ${model}`, {
        encoding: 'utf-8', timeout: 10000,
      })
      return NextResponse.json({ ok: true, agentId: id, model })
    } catch (primaryErr) {
      // Try alternative: openclaw agents set-model <id> <model>
      try {
        execSync(`${bin} agents set-model ${id} ${model}`, {
          encoding: 'utf-8', timeout: 10000,
        })
        return NextResponse.json({ ok: true, agentId: id, model })
      } catch {
        throw primaryErr
      }
    }
  } catch (err) {
    return apiErrorResponse(err, `Failed to set model for agent ${id}`)
  }
}
