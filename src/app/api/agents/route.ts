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

    // Fallback/base: filesystem discovery
    const fsAgents = loadRegistry()
    const workspacePath = process.env.WORKSPACE_PATH ?? ''

    const combinedAgents = new Map<string, any>()

    // Pre-populate with FS agents
    for (const a of fsAgents) {
      combinedAgents.set(a.id, {
        id: a.id,
        name: a.name,
        workspace: workspacePath,
        model: a.model ?? null,
        isDefault: !a.reportsTo,
        identityName: a.name,
        identityEmoji: a.emoji,
        bindings: 0,
        routes: [],
      })
    }

    let defaultId = fsAgents.find(a => !a.reportsTo)?.id ?? fsAgents[0]?.id ?? null

    // Override/merge with CLI data
    if (bin) {
      try {
        const raw = execSync(`${bin} agents list --json`, {
          encoding: 'utf-8',
          timeout: 10000,
        })
        const summaries = JSON.parse(raw) as CliAgentSummary[]
        if (Array.isArray(summaries) && summaries.length > 0) {
          const cliDefault = summaries.find(a => a.isDefault) ?? summaries[0]
          defaultId = cliDefault.id

          for (const a of summaries) {
            combinedAgents.set(a.id, {
              ...combinedAgents.get(a.id),
              id: a.id,
              name: a.identityName || a.name || a.id,
              workspace: a.workspace,
              agentDir: a.agentDir,
              model: a.model ?? combinedAgents.get(a.id)?.model ?? null,
              isDefault: a.isDefault,
              identityName: a.identityName || a.name || a.id,
              identityEmoji: a.identityEmoji ?? combinedAgents.get(a.id)?.identityEmoji ?? null,
              bindings: a.bindings ?? 0,
              routes: a.routes ?? [],
            })
          }
        }
      } catch {
        // CLI failed — ignore and continue with just FS agents
      }
    }

    return NextResponse.json({
      defaultId,
      agents: Array.from(combinedAgents.values()),

    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load agents')
  }
}
