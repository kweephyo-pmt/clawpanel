import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

// GET /api/agents/[id]/skills  - run `openclaw skills status --json --agent <id>`
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bin = process.env.OPENCLAW_BIN
    if (!bin) {
      return NextResponse.json({ skills: [], error: 'OPENCLAW_BIN not set' })
    }

    try {
      const raw = execSync(`${bin} skills status --json --agent ${id}`, {
        encoding: 'utf-8',
        timeout: 12000,
      })
      const data: unknown = JSON.parse(raw)
      return NextResponse.json(data)
    } catch {
      // Fallback: try without --agent flag
      try {
        const raw = execSync(`${bin} skills status --json`, {
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
