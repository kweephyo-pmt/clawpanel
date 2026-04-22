import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'
import { mainAgentDir, namedAgentDir } from '@/lib/agents-registry'

const ALLOWED_FILES = new Set([
  'AGENTS.md', 'SOUL.md', 'TOOLS.md', 'IDENTITY.md',
  'USER.md', 'HEARTBEAT.md', 'MEMORY.md',
])

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
  return process.env.WORKSPACE_PATH ?? null
}

// GET /api/agents/[id]/files/[name]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  try {
    const { id, name } = await params
    const decodedName = decodeURIComponent(name)

    if (!ALLOWED_FILES.has(decodedName)) {
      return NextResponse.json({ error: `File "${decodedName}" not allowed` }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const qsWorkspace = searchParams.get('workspace')
    const workspaceDir = qsWorkspace || resolveAgentWorkspaceDir(id)
    if (!workspaceDir) {
      return apiErrorResponse(new Error('WORKSPACE_PATH not set'), 'Not configured')
    }

    const agentDir = id === 'main' ? mainAgentDir() : namedAgentDir(id)
    const workspaceFilePath = join(workspaceDir, decodedName)
    const agentFilePath = join(agentDir, decodedName)

    let finalPath = workspaceFilePath
    let exists = existsSync(workspaceFilePath)

    if (!exists && existsSync(agentFilePath)) {
      finalPath = agentFilePath
      exists = true
    }

    const missing = !exists
    const content = missing ? '' : readFileSync(finalPath, 'utf-8')

    return NextResponse.json({
      agentId: id,
      workspace: workspaceDir,
      file: { name: decodedName, path: finalPath, missing, content },
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

    const { searchParams } = new URL(req.url)
    const qsWorkspace = searchParams.get('workspace')
    const workspaceDir = qsWorkspace || resolveAgentWorkspaceDir(id)
    if (!workspaceDir) {
      return apiErrorResponse(new Error('WORKSPACE_PATH not set'), 'Not configured')
    }

    const agentDir = id === 'main' ? mainAgentDir() : namedAgentDir(id)
    const workspaceFilePath = join(workspaceDir, decodedName)
    const agentFilePath = join(agentDir, decodedName)

    // If it exists in agentDir, save there. If it exists in workspaceDir, save there.
    // If it exists in neither, default to agentDir because that's the new standard for ClawPanel agents.
    let finalPath = agentFilePath
    if (existsSync(workspaceFilePath) && !existsSync(agentFilePath)) {
      finalPath = workspaceFilePath
    }

    const body = await req.json() as { content: string }
    
    mkdirSync(dirname(finalPath), { recursive: true })
    writeFileSync(finalPath, body.content, 'utf-8')

    return NextResponse.json({
      ok: true,
      agentId: id,
      workspace: workspaceDir,
      file: { name: decodedName, path: finalPath, missing: false },
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to write file')
  }
}
