import { NextResponse } from 'next/server'
import { existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

export type WorkspaceFileEntry = {
  name: string
  relativePath: string
  absolutePath: string
  size: number
  modifiedAt: number
  isDir: boolean
  ext: string
}

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

function collectFiles(dir: string, baseDir: string, depth = 0): WorkspaceFileEntry[] {
  if (depth > 4) return [] // safety limit
  const entries: WorkspaceFileEntry[] = []
  let items: string[]
  try {
    items = readdirSync(dir)
  } catch {
    return entries
  }
  for (const item of items) {
    // Skip hidden dirs/files except dot-files at root level
    if (item.startsWith('.') && depth > 0) continue
    const abs = join(dir, item)
    let stat
    try { stat = statSync(abs) } catch { continue }
    const rel = relative(baseDir, abs)
    const ext = item.includes('.') ? item.split('.').pop()!.toLowerCase() : ''
    entries.push({
      name: item,
      relativePath: rel,
      absolutePath: abs,
      size: stat.isFile() ? stat.size : 0,
      modifiedAt: stat.mtimeMs,
      isDir: stat.isDirectory(),
      ext,
    })
    if (stat.isDirectory()) {
      entries.push(...collectFiles(abs, baseDir, depth + 1))
    }
  }
  return entries
}

// GET /api/agents/[id]/workspace-files
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

    if (!existsSync(workspaceDir)) {
      return apiErrorResponse(new Error('Workspace not found'), `Directory not found: ${workspaceDir}`)
    }

    const files = collectFiles(workspaceDir, workspaceDir)
    // Tree order: sort by relativePath so children appear directly after their parent dir
    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

    return NextResponse.json({ agentId: id, workspace: workspaceDir, files })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to list workspace files')
  }
}
