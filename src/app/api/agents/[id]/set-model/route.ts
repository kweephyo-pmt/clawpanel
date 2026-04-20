import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

// POST /api/agents/[id]/set-model  { model: "provider/model-id" }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bin = process.env.OPENCLAW_BIN || 'openclaw'

  const body = await req.json() as { model?: string }
  const model = (body.model ?? '').trim()

  // Collect results from each attempt for debugging
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

  if (!model) {
    // Clear model — try unset then set empty
    const cleared = run(`${bin} config unset agents.entries.${id}.model`)
      || run(`${bin} config set agents.entries.${id}.model ""`)
    if (cleared) return NextResponse.json({ ok: true, agentId: id, model: null })
    return NextResponse.json({ error: 'Could not clear model', attempts }, { status: 500 })
  }

  // Try multiple command formats — quoted model value handles slashes/dots safely
  const q = JSON.stringify(model) // e.g. "moonshot/kimi-k2.5"

  // 1. Standard config key via dot path
  if (run(`${bin} config set agents.entries.${id}.model ${q}`)) {
    return NextResponse.json({ ok: true, agentId: id, model, attempts })
  }

  // 2. Without agent-id prefix (workspace-level default model)
  if (run(`${bin} config set model.primary ${q}`)) {
    return NextResponse.json({ ok: true, agentId: id, model, attempts })
  }

  // 3. agents set-model subcommand
  if (run(`${bin} agents set-model ${id} ${q}`)) {
    return NextResponse.json({ ok: true, agentId: id, model, attempts })
  }

  // 4. config set with --agent flag
  if (run(`${bin} config set model ${q} --agent ${id}`)) {
    return NextResponse.json({ ok: true, agentId: id, model, attempts })
  }

  // All failed — return all attempt details so UI can show what went wrong
  const lastError = attempts.filter(a => !a.success).at(-1)?.error ?? 'All set-model attempts failed'
  return NextResponse.json(
    {
      error: lastError,
      hint: 'Check that the openclaw CLI supports config set for model changes. Run: openclaw config --help',
      attempts,
    },
    { status: 500 }
  )
}
