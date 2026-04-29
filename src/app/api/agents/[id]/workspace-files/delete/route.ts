import { NextResponse } from 'next/server'
import { existsSync, rmSync, statSync } from 'fs'
import { join, resolve, relative } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { apiErrorResponse } from '@/lib/api-error'

const execAsync = promisify(exec)

async function resolveAgentWorkspaceDirAsync(id: string): Promise<string | null> {
  const bin = process.env.OPENCLAW_BIN
  if (bin) {
    try {
      const { stdout: raw } = await execAsync(`${bin} agents list --json`, {
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

// DELETE /api/agents/[id]/workspace-files/delete
// Body: { paths: string[], workspace?: string }
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json() as { paths?: unknown; workspace?: unknown }

    if (!Array.isArray(body.paths) || body.paths.length === 0) {
      return apiErrorResponse(new Error('paths must be a non-empty array'), 'Invalid request', 400)
    }

    const workspaceDir =
      (typeof body.workspace === 'string' ? body.workspace : null) ||
      await resolveAgentWorkspaceDirAsync(id)

    if (!workspaceDir) {
      return apiErrorResponse(new Error('Cannot determine workspace'), 'WORKSPACE_PATH not configured', 400)
    }

    const resolvedWorkspace = resolve(workspaceDir)
    const results: Array<{ path: string; ok: boolean; error?: string }> = []

    for (const rawPath of body.paths) {
      if (typeof rawPath !== 'string') {
        results.push({ path: String(rawPath), ok: false, error: 'Invalid path type' })
        continue
      }

      // Security: ensure path stays within workspace (no traversal)
      const abs = resolve(join(resolvedWorkspace, rawPath))
      const rel = relative(resolvedWorkspace, abs)
      if (rel.startsWith('..') || !abs.startsWith(resolvedWorkspace)) {
        results.push({ path: rawPath, ok: false, error: 'Path traversal not allowed' })
        continue
      }

      if (!existsSync(abs)) {
        results.push({ path: rawPath, ok: false, error: 'File not found' })
        continue
      }

      try {
        const stat = statSync(abs)
        rmSync(abs, stat.isDirectory() ? { recursive: true, force: true } : undefined)
        results.push({ path: rawPath, ok: true })
      } catch (e) {
        results.push({ path: rawPath, ok: false, error: e instanceof Error ? e.message : 'Delete failed' })
      }
    }

    const allOk = results.every(r => r.ok)
    return NextResponse.json({ results }, { status: allOk ? 200 : 207 })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to delete files')
  }
}
