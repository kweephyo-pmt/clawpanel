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
  model?: string       // e.g. "openrouter/moonshotai/kimi-k2"
  skills?: string[]    // skill ids for the per-agent allowlist
  tools?: string       // tools guidance text
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/**
 * Register the new agent in ~/.openclaw/openclaw.json under agents.list[].
 *
 * Key fields written:
 *   - id, identity (name + emoji), workspace, agentDir, model
 *   - skills: per-agent skill allowlist (agents.list[].skills)
 *     - undefined → agent inherits agents.defaults.skills (no restriction)
 *     - string[]  → explicit allowlist; replaces defaults, not merging
 *     - []        → no skills for this agent
 *
 * Non-fatal — if anything fails the agent files are already written.
 */
function registerAgentInConfig(entry: {
  id: string
  name: string
  emoji: string
  agentDir: string
  workspace: string
  model?: string
  skills?: string[]   // undefined = inherit defaults; [] = none; [...] = explicit list
}): void {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(configPath)) return

  let cfg: any
  try {
    const raw = readFileSync(configPath, 'utf-8')
    cfg = JSON.parse(raw)
  } catch {
    return
  }

  if (!cfg.agents) cfg.agents = {}
  if (!Array.isArray(cfg.agents.list)) cfg.agents.list = []

  // Skip if already registered
  if (cfg.agents.list.some((a: any) => a.id === entry.id)) return

  const agentEntry: Record<string, unknown> = {
    id: entry.id,
    workspace: entry.workspace,
    agentDir: entry.agentDir,
    identity: {
      name: entry.name,
      emoji: entry.emoji,
    },
  }

  if (entry.model) {
    agentEntry.model = entry.model
  }

  // skills is only written when explicitly provided.
  // undefined → omit the field entirely → agent inherits agents.defaults.skills
  // [] or [...] → written as the per-agent allowlist (replaces defaults, not merged)
  if (entry.skills !== undefined) {
    agentEntry.skills = entry.skills
  }

  cfg.agents.list.push(agentEntry)
  writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8')
}

// POST /api/agents/create
export async function POST(req: Request) {
  try {
    const body = await req.json() as CreateAgentBody
    const { name, emoji, description, model, tools } = body

    // skills === undefined → no allowlist (inherit defaults)
    // skills === [] → empty allowlist field was sent → treat as inherit
    // skills === ["a","b"] → explicit per-agent allowlist
    const skills: string[] | undefined =
      Array.isArray(body.skills) && body.skills.length > 0
        ? body.skills
        : undefined

    const id = body.id || slugify(name)
    if (!id) {
      return NextResponse.json({ error: 'Agent id is required' }, { status: 400 })
    }

    // 1. Determine target directory — WORKSPACE_PATH/agents/<id> preferred
    const targetDir = process.env.WORKSPACE_PATH
      ? join(process.env.WORKSPACE_PATH, 'agents', id)
      : join(homedir(), '.openclaw', 'agents', id)

    if (existsSync(targetDir)) {
      return NextResponse.json({ error: `Agent "${id}" already exists` }, { status: 409 })
    }

    // 2. Create agent directory
    mkdirSync(targetDir, { recursive: true })

    // 3. Write IDENTITY.md
    writeFileSync(join(targetDir, 'IDENTITY.md'), `# IDENTITY.md — Who Am I?

- **Name:** ${name}
- **Creature:** AI assistant
- **Vibe:** Focused, precise, and task-aligned
- **Emoji:** ${emoji}
- **Avatar:**

---

${description}
`, 'utf-8')

    // 4. Write SOUL.md
    //    The skill allowlist is enforced by openclaw.json, not by listing names here.
    //    We mention the scope so the agent understands its focus area, but the
    //    actual enforcement lives in the config entry written below.
    const skillsNote = skills && skills.length > 0
      ? `## Skill Scope\nThis agent is configured with a focused skill allowlist: ${skills.join(', ')}.\nStay within these capabilities unless explicitly directed otherwise.\n\n`
      : ''

    writeFileSync(join(targetDir, 'SOUL.md'), `# SOUL.md — ${name}

## Who You Are
${description}

## Your Purpose
You are a focused agent. Stay aligned with your designated task area. Do not take on work outside your scope — escalate to the main orchestrator when appropriate.

${skillsNote}## Working Style
- Be concise and precise
- Confirm before taking irreversible actions
- Log your work clearly so the team can follow along
`, 'utf-8')

    // 5. Write TOOLS.md
    writeFileSync(join(targetDir, 'TOOLS.md'), tools || `# TOOLS.md — ${name}

Use available tools to accomplish tasks within your area of focus.
Stay within the scope defined in your SOUL.md.
`, 'utf-8')

    // 6. Write AGENTS.md
    writeFileSync(join(targetDir, 'AGENTS.md'), `# ${name} Agent

${description}

## Model
${model ? `Primary: ${model}` : 'Uses gateway default model.'}

## Skill Allowlist
${skills && skills.length > 0 ? skills.join(', ') : 'Inherits agents.defaults.skills (no per-agent restriction).'}
`, 'utf-8')

    // 7. Register in openclaw.json — this writes the per-agent skill allowlist
    //    under agents.list[].skills, which is what openclaw reads natively.
    try {
      registerAgentInConfig({
        id,
        name,
        emoji,
        agentDir: targetDir,
        workspace: targetDir,
        model,
        skills, // undefined → field omitted; string[] → explicit allowlist
      })
    } catch (e) {
      console.warn('Failed to register agent in openclaw.json:', e)
    }

    // 8. Reload gateway so the new agent + skill allowlist takes effect immediately
    const bin = process.env.OPENCLAW_BIN || 'openclaw'
    try {
      execSync(`${bin} config reload`, { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' })
    } catch (e) {
      console.warn('config reload failed (gateway may not be local):', e)
    }

    return NextResponse.json({
      ok: true,
      agent: {
        id,
        name,
        emoji,
        agentDir: targetDir,
        description,
        model,
        skills: skills ?? [],
      },
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to create agent')
  }
}
