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

  // 1. Safe global CLI sync if it's the main agent
  if (id === 'main') {
    run(`${bin} models set ${q}`)
    run(`${bin} config set model.primary ${q}`)
  }

  // 2. Prioritize hitting the OpenClaw Gateway natively just like Control UI does
  const token = process.env.OPENCLAW_GATEWAY_TOKEN || ''
  try {
    const res = await fetch('http://127.0.0.1:18789/rpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "agents.update",
        params: { agentId: id, model: model }
      })
    })

    if (res.ok) {
      const data = await res.json()
      if (data.result?.ok) {
        return NextResponse.json({ ok: true, agentId: id, model, source: 'rpc' })
      }
      attempts.push({ cmd: 'RPC agents.update', success: false, error: JSON.stringify(data.error) })
    } else {
      attempts.push({ cmd: 'RPC agents.update', success: false, error: `HTTP ${res.status}` })
    }
  } catch (e: any) {
    attempts.push({ cmd: 'RPC agents.update', success: false, error: e.message })
  }

  // All failed — return all attempt details
  const lastError = attempts.filter(a => !a.success).at(-1)?.error ?? 'All set-model attempts failed'
  return NextResponse.json(
    {
      error: lastError,
      hint: 'Check that the gateway is running on 127.0.0.1:18789',
      attempts,
    },
    { status: 500 }
  )
}
