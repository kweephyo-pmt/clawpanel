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

  // Attempt 1: Safe global CLI sync if it's the main agent
  if (id === 'main') {
    run(`${bin} models set ${q}`)
    run(`${bin} config set model.primary ${q}`)
    return NextResponse.json({ ok: true, agentId: id, model, source: 'cli-main' })
  }

  // Attempt 2: Blazing fast filesystem mutation of AGENTS.md + Gateway RPC broadcast
  try {
    const fs = require('fs')
    const path = require('path')
    const workspacePath = process.env.WORKSPACE_PATH || ''
    const mdPath = path.join(workspacePath, 'agents', id, 'AGENTS.md')
    
    if (fs.existsSync(mdPath)) {
      let content = fs.readFileSync(mdPath, 'utf-8')
      const hasModelHeader = content.match(/## Model/i)
      
      if (hasModelHeader) {
        if (content.match(/Primary:.*$/m)) {
          content = content.replace(/Primary:.*$/m, `Primary: ${model}`)
        } else {
          content = content.replace(/## Model/i, `## Model\nPrimary: ${model}`)
        }
      } else {
        content += `\n\n## Model\nPrimary: ${model}\n`
      }

      // Write physical file
      fs.writeFileSync(mdPath, content, 'utf-8')
      
      // Ping the Gateway super instantly over HTTP RPC to invalidate its caching layer
      try {
        const token = process.env.OPENCLAW_GATEWAY_TOKEN || ''
        await fetch('http://127.0.0.1:18789/rpc', {
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
      } catch (e) {
        console.warn('RPC broadcast failed, but file was successfully written:', e)
      }
      
      return NextResponse.json({ ok: true, agentId: id, model, source: 'fs-rpc' })
    }
    
    return NextResponse.json({ error: 'Agent AGENTS.md not found' }, { status: 404 })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to write agent model override', desc: e.message }, { status: 500 })
  }
}
