import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { loadRegistry } from '@/lib/agents-registry'
import { apiErrorResponse } from '@/lib/api-error'

const ALLOWED_FILES = new Set([
  'AGENTS.md', 'SOUL.md', 'TOOLS.md', 'IDENTITY.md',
  'USER.md', 'HEARTBEAT.md', 'BOOTSTRAP.md', 'MEMORY.md', 'memory.md',
])

function resolveWorkspaceDir(id: string): string | null {
  const workspacePath = process.env.WORKSPACE_PATH
  if (!workspacePath) return null

  const agents = loadRegistry()
  const agent = agents.find(a => a.id === id)
  if (!agent) return workspacePath

  if (agent.soulPath && agent.soulPath.startsWith('agents/')) {
    const parts = agent.soulPath.split('/')
    if (parts.length >= 3) {
      return join(workspacePath, parts[0], parts[1])
    }
  }
  return workspacePath
}

// GET /api/agents/[id]/files/[name]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  try {
    const { id, name } = await params
    const decodedName = decodeURIComponent(name)

    if (!ALLOWED_FILES.has(decodedName)) {
      return NextResponse.json({ error: `File "${decodedName}" not allowed` }, { status: 400 })
    }

    const workspaceDir = resolveWorkspaceDir(id)
    if (!workspaceDir) {
      return apiErrorResponse(new Error('WORKSPACE_PATH not set'), 'Not configured')
    }

    const filePath = join(workspaceDir, decodedName)
    const missing = !existsSync(filePath)
    const content = missing ? '' : readFileSync(filePath, 'utf-8')

    return NextResponse.json({
      agentId: id,
      workspace: workspaceDir,
      file: { name: decodedName, path: filePath, missing, content },
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to read file')
  }
}

// PUT /api/agents/[id]/files/[name]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  try {
    const { id, name } = await params
    const decodedName = decodeURIComponent(name)

    if (!ALLOWED_FILES.has(decodedName)) {
      return NextResponse.json({ error: `File "${decodedName}" not allowed` }, { status: 400 })
    }

    const workspaceDir = resolveWorkspaceDir(id)
    if (!workspaceDir) {
      return apiErrorResponse(new Error('WORKSPACE_PATH not set'), 'Not configured')
    }

    const body = await req.json() as { content: string }
    const filePath = join(workspaceDir, decodedName)

    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, body.content, 'utf-8')

    return NextResponse.json({
      ok: true,
      agentId: id,
      workspace: workspaceDir,
      file: { name: decodedName, path: filePath, missing: false },
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to write file')
  }
}
