import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

// POST /api/agents/[id]/set-model  { model: "provider/model-id" }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bin = process.env.OPENCLAW_BIN

  if (!bin) {
    return NextResponse.json({ error: 'OPENCLAW_BIN not configured on server' }, { status: 503 })
  }

  const body = await req.json() as { model?: string }
  const model = (body.model ?? '').trim()

  const attempts: Array<{ cmd: string; success: boolean; output?: string; error?: string }> = []

  function run(cmd: string): boolean {
    try {
      const out = execSync(cmd, { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] })
      attempts.push({ cmd, success: true, output: out.trim() })
      return true
    } catch (e) {
      const msg = (e as { stderr?: string; message?: string }).stderr?.trim()
        || (e as { message?: string }).message?.trim()
        || String(e)
      attempts.push({ cmd, success: false, error: msg })
      return false
    }
  }

  // ── Clear model ──────────────────────────────────────────────────────────────
  if (!model) {
    const cleared =
      run(`${bin} config unset agents.entries.${id}.model`) ||
      run(`${bin} config set agents.entries.${id}.model ""`)
    if (cleared) return NextResponse.json({ ok: true, agentId: id, model: null })
    return NextResponse.json({ error: 'Could not clear model', attempts }, { status: 500 })
  }

  // ── Set model ────────────────────────────────────────────────────────────────
  // Quote the value so slashes and dots are safe
  const q = JSON.stringify(model) // e.g. "moonshot/kimi-k2.5"

  // 1. Per-agent config key (works for any agent id)
  const ok1 = run(`${bin} config set agents.entries.${id}.model ${q}`)

  // 2. If this is the main/default agent, also set the top-level primary model key
  if (id === 'main') {
    run(`${bin} config set model.primary ${q}`)
    run(`${bin} models set ${q}`)
  }

  if (ok1) {
    return NextResponse.json({ ok: true, agentId: id, model, source: 'cli' })
  }

  // 3. Fallback: try `openclaw agent set-model` if the CLI supports it
  const ok3 = run(`${bin} agent ${id} set-model ${q}`)
  if (ok3) {
    return NextResponse.json({ ok: true, agentId: id, model, source: 'cli-agent' })
  }

  // All attempts failed — return details for debugging
  const lastError = attempts.filter(a => !a.success).at(-1)?.error ?? 'All set-model attempts failed'
  return NextResponse.json(
    {
      error: lastError,
      hint: 'Check that OPENCLAW_BIN is correct and the openclaw CLI is functional on the server.',
      attempts,
    },
    { status: 500 }
  )
}
