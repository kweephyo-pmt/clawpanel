import { NextResponse } from 'next/server'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
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

/**
 * Append the new agent to `agents.list` in ~/.openclaw/openclaw.json.
 * Non-fatal — if anything fails the agent files are already written.
 */
function registerAgentInConfig(entry: {
  id: string
  name: string
  emoji: string
  agentDir: string
  workspace: string
  model?: string
}): void {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(configPath)) return

  let cfg: any
  try {
    const raw = readFileSync(configPath, 'utf-8')
    cfg = JSON.parse(raw)
  } catch {
    return // malformed JSON — skip
  }

  // Ensure agents.list exists
  if (!cfg.agents) cfg.agents = {}
  if (!Array.isArray(cfg.agents.list)) cfg.agents.list = []

  // Skip if already registered
  if (cfg.agents.list.some((a: any) => a.id === entry.id)) return

  cfg.agents.list.push({
    id: entry.id,
    workspace: entry.workspace,
    agentDir: entry.agentDir,
    ...(entry.model ? { model: entry.model } : {}),
    identity: {
      name: entry.name,
      emoji: entry.emoji,
    },
  })

  writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8')
}

// POST /api/agents/create
export async function POST(req: Request) {
  try {
    const body = await req.json() as CreateAgentBody
    const { name, emoji, description, model, skills = [], tools } = body

    const id = body.id || slugify(name)
    if (!id) {
      return NextResponse.json({ error: 'Agent id is required' }, { status: 400 })
    }

    // Write into the OpenClaw runtime agent directory: ~/.openclaw/agents/<id>
    const agentDir = join(homedir(), '.openclaw', 'agents', id)
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

    // Register in openclaw.json agents.list
    const primaryWorkspace = process.env.WORKSPACE_PATH || agentDir
    try {
      registerAgentInConfig({
        id,
        name,
        emoji,
        agentDir,
        workspace: join(primaryWorkspace, 'agents', id),
        model,
      })
    } catch (e) {
      console.warn('Failed to register agent in openclaw.json:', e)
    }

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
      agent: { id, name, emoji, agentDir, description, model, skills },
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to create agent')
  }
}

