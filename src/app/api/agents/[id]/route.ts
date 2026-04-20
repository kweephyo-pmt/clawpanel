import { NextResponse } from 'next/server'
import { rmSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

// DELETE /api/agents/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (id === 'main') {
      return NextResponse.json({ error: 'Cannot delete the main orchestrator agent.' }, { status: 403 })
    }

    const workspacePath = process.env.WORKSPACE_PATH
    if (!workspacePath) {
      return NextResponse.json({ error: 'WORKSPACE_PATH not configured' }, { status: 503 })
    }

    const agentDir = join(workspacePath, 'agents', id)
    
    if (!existsSync(agentDir)) {
      return NextResponse.json({ error: `Agent workspace not found: ${id}` }, { status: 404 })
    }

    // Recursively delete the agent directory
    rmSync(agentDir, { recursive: true, force: true })

    // Try to reload the openclaw gateway config to reflect the deletion
    const bin = process.env.OPENCLAW_BIN
    if (bin) {
      try {
        // Prevent hanging by ignoring stdio pipes
        execSync(`${bin} config reload`, { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' })
      } catch (e) {
        console.warn('config reload failed after delete:', e)
      }
    }

    return NextResponse.json({ ok: true, deletedId: id })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to delete agent')
  }
}
