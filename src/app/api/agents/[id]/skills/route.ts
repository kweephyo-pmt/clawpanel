import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { apiErrorResponse } from '@/lib/api-error'

const execAsync = promisify(exec)

// GET /api/agents/[id]/skills  - run `openclaw skills status --json --agent <id>`
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bin = process.env.OPENCLAW_BIN || 'openclaw'

    try {
      const { stdout: raw } = await execAsync(`${bin} skills status --json --agent ${id}`, {
        encoding: 'utf-8',
        timeout: 12000,
      })
      const data: unknown = JSON.parse(raw)
      return NextResponse.json(data)
    } catch {
      // Fallback: try without --agent flag
      try {
        const { stdout: raw } = await execAsync(`${bin} skills status --json`, {
          encoding: 'utf-8',
          timeout: 12000,
        })
        const data: unknown = JSON.parse(raw)
        return NextResponse.json(data)
      } catch {
        return NextResponse.json({ skills: [], workspaceDir: process.env.WORKSPACE_PATH ?? '' })
      }
    }
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch skills')
  }
}
