import { NextResponse } from 'next/server'
import { existsSync, createReadStream, statSync } from 'fs'
import { join, normalize, resolve } from 'path'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

const DOWNLOAD_ALLOWED_EXTS = new Set([
  'md', 'txt', 'json', 'csv', 'html', 'htm', 'pdf',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg',
  'zip', 'log', 'xml', 'yaml', 'yml', 'ts', 'js',
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

function getMimeType(ext: string, filename: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    html: 'text/html',
    htm: 'text/html',
    json: 'application/json',
    csv: 'text/csv',
    md: 'text/markdown',
    txt: 'text/plain',
    log: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    zip: 'application/zip',
    xml: 'application/xml',
    yaml: 'text/yaml',
    yml: 'text/yaml',
  }
  return map[ext] ?? 'application/octet-stream'
}

// GET /api/agents/[id]/workspace-files/download?path=relative/path/to/file
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const relPath = searchParams.get('path')
    const qsWorkspace = searchParams.get('workspace')

    if (!relPath) {
      return NextResponse.json({ error: 'Missing path param' }, { status: 400 })
    }

    const workspaceDir = qsWorkspace || resolveAgentWorkspaceDir(id)
    if (!workspaceDir) {
      return apiErrorResponse(new Error('Cannot determine workspace'), 'WORKSPACE_PATH not configured')
    }

    // Security: resolve and ensure path stays within workspace
    const absPath = resolve(join(workspaceDir, relPath))
    const safeBase = resolve(workspaceDir)
    if (!absPath.startsWith(safeBase + '/') && absPath !== safeBase) {
      return NextResponse.json({ error: 'Path traversal not allowed' }, { status: 403 })
    }

    if (!existsSync(absPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const stat = statSync(absPath)
    if (stat.isDirectory()) {
      return NextResponse.json({ error: 'Cannot download a directory' }, { status: 400 })
    }

    const filename = absPath.split('/').pop() ?? 'download'
    const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : ''

    if (!DOWNLOAD_ALLOWED_EXTS.has(ext)) {
      return NextResponse.json({ error: `File type .${ext} not allowed for download` }, { status: 403 })
    }

    const mimeType = getMimeType(ext, filename)
    const { Readable } = await import('stream')
    const nodeStream = createReadStream(absPath)
    const webStream = Readable.toWeb(nodeStream) as ReadableStream

    return new Response(webStream, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to download file')
  }
}
