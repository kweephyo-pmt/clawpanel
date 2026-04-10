import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { loadRegistry } from '@/lib/agents-registry'
import { apiErrorResponse } from '@/lib/api-error'

/** Shape returned by `openclaw agents list --json` */
type CliAgentSummary = {
  id: string
  name?: string
  identityName?: string
  identityEmoji?: string
  workspace: string
  agentDir?: string
  model?: string
  isDefault: boolean
  bindings?: number
  routes?: string[]
}

export async function GET() {
  try {
    const bin = process.env.OPENCLAW_BIN

    // --- Primary: use `openclaw agents list --json` (same source as openclaw UI) ---
    if (bin) {
      try {
        const raw = execSync(`${bin} agents list --json`, {
          encoding: 'utf-8',
          timeout: 10000,
        })
        const summaries = JSON.parse(raw) as CliAgentSummary[]
        if (Array.isArray(summaries) && summaries.length > 0) {
          const defaultAgent = summaries.find(a => a.isDefault) ?? summaries[0]
          return NextResponse.json({
            defaultId: defaultAgent.id,
            agents: summaries.map(a => ({
              id: a.id,
              name: a.identityName || a.name || a.id,
              workspace: a.workspace,
              agentDir: a.agentDir,
              model: a.model ?? null,
              isDefault: a.isDefault,
              identityName: a.identityName || a.name || a.id,
              identityEmoji: a.identityEmoji ?? null,
              bindings: a.bindings ?? 0,
              routes: a.routes ?? [],
            })),
          })
        }
      } catch {
        // CLI failed — fall through to filesystem discovery
      }
    }

    // --- Fallback: filesystem discovery ---
    const agents = loadRegistry()
    const workspacePath = process.env.WORKSPACE_PATH ?? ''
    const rootAgent = agents.find(a => !a.reportsTo)

    return NextResponse.json({
      defaultId: rootAgent?.id ?? agents[0]?.id ?? null,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        workspace: workspacePath,
        model: a.model ?? null,
        isDefault: !a.reportsTo,
        identityName: a.name,
        identityEmoji: a.emoji,
      })),
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load agents')
  }
}
