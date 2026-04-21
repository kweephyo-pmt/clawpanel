import { NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'fs'
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
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const qsWorkspace = searchParams.get('workspace')
    const workspaceDir = qsWorkspace || resolveAgentWorkspaceDir(id)

    if (!workspaceDir) {
      return apiErrorResponse(new Error('Cannot determine workspace'), 'WORKSPACE_PATH not configured')
    }

    const ALWAYS_SHOW = new Set(['SOUL.md', 'IDENTITY.md', 'TOOLS.md', 'AGENTS.md'])
    const files = WORKSPACE_FILES
      .map(name => {
        const filePath = join(workspaceDir, name)
        const exists = existsSync(filePath)
        // Read content inline so the client needs only one round-trip
        const content = exists ? readFileSync(filePath, 'utf-8') : ''
        return { name, path: filePath, missing: !exists, content }
      })
      .filter(f => !f.missing || ALWAYS_SHOW.has(f.name))

    return NextResponse.json({
      agentId: id,
      workspace: workspaceDir,
      files,
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch agent files')
  }
}
