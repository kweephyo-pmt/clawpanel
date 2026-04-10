import { NextResponse } from 'next/server'
import { join } from 'path'
import { loadRegistry } from '@/lib/agents-registry'
import { apiErrorResponse } from '@/lib/api-error'

export async function GET() {
  try {
    const agents = loadRegistry()
    const workspacePath = process.env.WORKSPACE_PATH ?? ''

    // Root agent = no reportsTo (orchestrator)
    const rootAgent = agents.find(a => !a.reportsTo)

    const mapped = agents.map(a => {
      // Determine the workspace directory for this agent
      let workspace = workspacePath
      if (a.soulPath?.startsWith('agents/')) {
        const parts = a.soulPath.split('/')
        if (parts.length >= 3) workspace = join(workspacePath, parts[0], parts[1])
      }
      return {
        id: a.id,
        name: a.name,
        workspace,
        model: a.model ?? null,
        isDefault: !a.reportsTo,
        identityName: a.name,
        identityEmoji: a.emoji,
        reportsTo: a.reportsTo,
        directReports: a.directReports,
        title: a.title,
      }
    })

    return NextResponse.json({
      defaultId: rootAgent?.id ?? agents[0]?.id ?? null,
      agents: mapped,
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load agents')
  }
}
