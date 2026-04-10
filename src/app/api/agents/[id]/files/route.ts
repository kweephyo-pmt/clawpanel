import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'
import { loadRegistry } from '@/lib/agents-registry'
import { apiErrorResponse } from '@/lib/api-error'

const WORKSPACE_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'BOOTSTRAP.md',
  'MEMORY.md',
  'memory.md',
] as const

// GET /api/agents/[id]/files
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspacePath = process.env.WORKSPACE_PATH
    if (!workspacePath) {
      return apiErrorResponse(new Error('WORKSPACE_PATH not set'), 'WORKSPACE_PATH not configured')
    }

    // Find workspace directory for this agent
    const agents = loadRegistry()
    const agent = agents.find(a => a.id === id)

    // Determine workspace dir: root workspace for orchestrators, subdir for others
    let workspaceDir = workspacePath
    if (agent?.soulPath && agent.soulPath.startsWith('agents/')) {
      // e.g. agents/kaze/SOUL.md -> workspace is workspacePath/agents/kaze
      const parts = agent.soulPath.split('/')
      if (parts.length >= 3) {
        workspaceDir = join(workspacePath, parts[0], parts[1])
      }
    } else if (agent?.soulPath === null && agent?.reportsTo) {
      // Sub-agent with no known soulPath - skip
      return NextResponse.json({
        agentId: id,
        workspace: workspacePath,
        files: [],
      })
    }

    const files = WORKSPACE_FILES.map(name => {
      const filePath = join(workspaceDir, name)
      const exists = existsSync(filePath)
      return { name, path: filePath, missing: !exists }
    })

    return NextResponse.json({
      agentId: id,
      workspace: workspaceDir,
      files,
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch agent files')
  }
}
