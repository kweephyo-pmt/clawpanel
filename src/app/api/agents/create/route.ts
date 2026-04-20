import { NextResponse } from 'next/server'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

type CreateAgentBody = {
  id: string           // e.g. "sales-bot"
  name: string         // e.g. "SalesBot"
  emoji: string        // e.g. "💼"
  description: string  // free text, what this agent does
  model?: string       // e.g. "moonshot/kimi-k2.5"
  skills?: string[]    // skill ids to reference
  tools?: string       // tools guidance text
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// POST /api/agents/create
export async function POST(req: Request) {
  try {
    const body = await req.json() as CreateAgentBody
    const { name, emoji, description, model, skills = [], tools } = body

    const workspacePath = process.env.WORKSPACE_PATH
    if (!workspacePath) {
      return NextResponse.json({ error: 'WORKSPACE_PATH not configured' }, { status: 503 })
    }

    const id = body.id || slugify(name)
    if (!id) {
      return NextResponse.json({ error: 'Agent id is required' }, { status: 400 })
    }

    const agentDir = join(workspacePath, 'agents', id)
    if (existsSync(agentDir)) {
      return NextResponse.json({ error: `Agent "${id}" already exists` }, { status: 409 })
    }

    // Create agent directory
    mkdirSync(agentDir, { recursive: true })

    // Write IDENTITY.md
    const identityMd = `# IDENTITY.md — Who Am I?

- **Name:** ${name}
- **Creature:** AI assistant
- **Vibe:** Focused, precise, and task-aligned
- **Emoji:** ${emoji}
- **Avatar:**

---

${description}
`
    writeFileSync(join(agentDir, 'IDENTITY.md'), identityMd, 'utf-8')

    // Write SOUL.md
    const skillsSection = skills.length > 0
      ? `\n## Skills\nThis agent has access to the following skills:\n${skills.map(s => `- ${s}`).join('\n')}\n`
      : ''

    const soulMd = `# SOUL.md — ${name}

## Who You Are
${description}

## Your Purpose
You are a focused agent. Stay aligned with your designated task area. Do not take on work outside your scope — escalate to the main orchestrator when appropriate.
${skillsSection}
## Working Style
- Be concise and precise
- Confirm before taking irreversible actions
- Log your work clearly so the team can follow along
`
    writeFileSync(join(agentDir, 'SOUL.md'), soulMd, 'utf-8')

    // Write TOOLS.md
    const toolsContent = tools
      || `# TOOLS.md — ${name}

Use available tools to accomplish tasks within your area of focus.
Stay within the scope defined in your SOUL.md.
`
    writeFileSync(join(agentDir, 'TOOLS.md'), toolsContent, 'utf-8')

    // Write AGENTS.md (minimal)
    const agentsMd = `# ${name} Agent

${description}

## Model
${model ? `Primary: ${model}` : 'Uses gateway default model.'}

## Skills Filter
${skills.length > 0 ? skills.join(', ') : 'all skills'}
`
    writeFileSync(join(agentDir, 'AGENTS.md'), agentsMd, 'utf-8')

    // Try to reload the openclaw gateway config (non-fatal if it fails)
    const bin = process.env.OPENCLAW_BIN || 'openclaw'
    try {
      // Prevent hanging by ignoring stdio pipes
      execSync(`${bin} config reload`, { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' })
    } catch (e) {
      // gateway may not be running locally — agent files are written, reload manually
      console.warn('config reload failed:', e)
    }

    return NextResponse.json({
      ok: true,
      agent: { id, name, emoji, workspace: agentDir, description, model, skills },
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to create agent')
  }
}
