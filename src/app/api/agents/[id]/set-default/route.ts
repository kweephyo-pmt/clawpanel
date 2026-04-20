import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

// POST /api/agents/[id]/set-default
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bin = process.env.OPENCLAW_BIN || 'openclaw'
  try {
    execSync(`${bin} config set agents.default ${id}`, {
      encoding: 'utf-8',
      timeout: 10000,
    })
    
    // Attempt non-fatal reload
    try {
      execSync(`${bin} config reload`, { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' })
    } catch (e) {
      console.warn('config reload failed:', e)
    }

    return NextResponse.json({ ok: true, defaultId: id })
  } catch (err) {
    return apiErrorResponse(err, `Failed to set default agent: ${id}`)
  }
}
