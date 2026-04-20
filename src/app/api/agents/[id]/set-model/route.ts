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
  }

  // Attempt 2: Direct filesystem mutation of AGENTS.md (The most reliable way)
  try {
    const fs = require('fs')
    const path = require('path')
    const workspacePath = process.env.WORKSPACE_PATH || ''
    const agentDir = id === 'main' ? workspacePath : path.join(workspacePath, 'agents', id)
    const mdPath = path.join(agentDir, 'AGENTS.md')
    
    if (fs.existsSync(mdPath)) {
      let content = fs.readFileSync(mdPath, 'utf-8')
      const hasModelHeader = content.match(/## Model/i)
      
      if (hasModelHeader) {
        // Replace existing Primary line under the Model header
        if (content.match(/Primary:.*$/m)) {
          content = content.replace(/Primary:.*$/m, `Primary: ${model}`)
        } else {
          content = content.replace(/## Model/i, `## Model\nPrimary: ${model}`)
        }
      } else {
        // Append Model header if entirely missing
        content += `\n\n## Model\nPrimary: ${model}\n`
      }

      fs.writeFileSync(mdPath, content, 'utf-8')
      
      // Force gateway to notice filesystem changes
      try {
        execSync(`${bin} config reload`, { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' })
      } catch (e) { console.warn('config reload failed:', e) }
      
      return NextResponse.json({ ok: true, agentId: id, model, source: 'fs' })
    }
  } catch (e: any) {
    attempts.push({ cmd: 'Direct FS Write AGENTS.md', success: false, error: e.message })
  }

  // Attempt 3: Legacy dot notation config set
  if (run(`${bin} config set agents.entries.${id}.model ${q}`)) {
    try {
      execSync(`${bin} config reload`, { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' })
    } catch (e) {}
    return NextResponse.json({ ok: true, agentId: id, model, source: 'cli' })
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
