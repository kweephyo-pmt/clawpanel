import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

const WORKSPACE_FILES = [
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'IDENTITY.md',
  'USER.md',
  'HEARTBEAT.md',
  'MEMORY.md',
] as const

/** Get the workspace directory for an agent from the CLI */
function resolveAgentWorkspaceDir(id: string): string | null {
  const bin = process.env.OPENCLAW_BIN
  if (bin) {
    try {
      const raw = execSync(`${bin} agents list --json`, {
        encoding: 'utf-8',
        timeout: 8000,
      })
      const summaries = JSON.parse(raw) as Array<{ id: string; workspace: string }>
      const match = summaries.find(a => a.id === id)
      if (match?.workspace) return match.workspace
    } catch {}
  }
  // Fallback: use WORKSPACE_PATH
  return process.env.WORKSPACE_PATH ?? null
}

// GET /api/agents/[id]/files
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspaceDir = resolveAgentWorkspaceDir(id)

    if (!workspaceDir) {
      return apiErrorResponse(new Error('Cannot determine workspace'), 'WORKSPACE_PATH not configured')
    }

    const files = WORKSPACE_FILES.map(name => {
      const filePath = join(workspaceDir, name)
      const exists = existsSync(filePath)
      return { name, path: filePath, missing: !exists }
    }).filter(f => !f.missing || ['SOUL.md', 'IDENTITY.md', 'TOOLS.md', 'AGENTS.md'].includes(f.name))

    return NextResponse.json({
      agentId: id,
      workspace: workspaceDir,
      files,
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch agent files')
  }
}
