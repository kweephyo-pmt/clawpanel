import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

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
  _req: Request,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  try {
    const { id, name } = await params
    const decodedName = decodeURIComponent(name)

    if (!ALLOWED_FILES.has(decodedName)) {
      return NextResponse.json({ error: `File "${decodedName}" not allowed` }, { status: 400 })
    }

    const workspaceDir = resolveAgentWorkspaceDir(id)
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

    const workspaceDir = resolveAgentWorkspaceDir(id)
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
