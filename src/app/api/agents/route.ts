import { NextResponse } from 'next/server'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { loadRegistry, listCliAgents, mainAgentDir, namedAgentDir } from '@/lib/agents-registry'
import { apiErrorResponse } from '@/lib/api-error'

function readConfig(): any {
  const p = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return null }
}

export async function GET() {
  try {
    const bin = process.env.OPENCLAW_BIN || 'openclaw'

    // Fallback/base: filesystem discovery
    const fsAgents = loadRegistry()
    const workspacePath = process.env.WORKSPACE_PATH ?? ''

    const combinedAgents = new Map<string, any>()

    // Pre-populate with FS agents
    for (const a of fsAgents) {
      // If reportsTo is null, it's the root agent at WORKSPACE_PATH. Otherwise, it's a sub-agent.
      const isRoot = !a.reportsTo
      const agentPath = isRoot ? workspacePath : join(workspacePath, 'agents', a.id)
      const openclawDir = isRoot ? mainAgentDir() : namedAgentDir(a.id)

      combinedAgents.set(a.id, {
        id: a.id,
        name: a.name,
        workspace: agentPath,
        agentDir: openclawDir,
        model: a.model ?? null,
        isDefault: isRoot,
        identityName: a.name,
        identityEmoji: a.emoji,
        bindings: 0,
        routes: [],
      })
    }

    let defaultId = fsAgents.find(a => !a.reportsTo)?.id ?? fsAgents[0]?.id ?? null

    // Override/merge with config data directly
    try {
      const summaries = listCliAgents(bin)
      if (Array.isArray(summaries) && summaries.length > 0) {
        const cliDefault = summaries.find(a => a.isDefault) ?? summaries[0]
        defaultId = cliDefault.id

        for (const a of summaries) {
          const isMain = a.id === defaultId || a.id === 'main'
          // For the main agent, strictly enforce the public custom WORKSPACE_PATH
          // so we don't accidentally display the internal wrapper path.
          const dedicatedPath = isMain
            ? (process.env.WORKSPACE_PATH || a.workspace)
            : a.workspace

          combinedAgents.set(a.id, {
            ...combinedAgents.get(a.id),
            id: a.id,
            name: a.identityName || combinedAgents.get(a.id)?.name || a.id,
            workspace: dedicatedPath || combinedAgents.get(a.id)?.workspace ,
            agentDir: a.agentDir || combinedAgents.get(a.id)?.agentDir,
            model: a.model ?? combinedAgents.get(a.id)?.model ?? null,
            isDefault: a.isDefault,
            identityName: a.identityName || combinedAgents.get(a.id)?.name || a.id,
            identityEmoji: a.identityEmoji ?? combinedAgents.get(a.id)?.identityEmoji ?? null,
            bindings: 0, // Will be calculated below
            routes: [],
          })
        }
      }
    } catch {
      // config read failed — ignore and continue with just FS agents
    }

    // Calculate actual bindings per agent from openclaw.json
    const cfg = readConfig()
    const allBindings = cfg?.bindings ?? []
    const defaultAcc = cfg?.channels?.telegram?.accounts?.['default']
    const defaultIsClaimed = allBindings.some((b: any) => b?.match?.channel === 'telegram' && b?.match?.accountId === 'default')

    for (const [id, agent] of combinedAgents.entries()) {
      let count = allBindings.filter((b: any) => b && b.agentId === id).length
      // Main agent implicit default account check
      if (agent.isDefault && defaultAcc && !defaultIsClaimed) {
        count += 1
      }
      agent.bindings = count
    }

    return NextResponse.json({
      defaultId,
      agents: Array.from(combinedAgents.values()),
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load agents')
  }
}
