import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

// POST /api/agents/[id]/set-default
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const bin = process.env.OPENCLAW_BIN
  if (!bin) {
    return NextResponse.json({ error: 'OPENCLAW_BIN not set' }, { status: 503 })
  }
  try {
    execSync(`${bin} agents set-default ${id}`, {
      encoding: 'utf-8',
      timeout: 10000,
    })
    return NextResponse.json({ ok: true, defaultId: id })
  } catch (err) {
    return apiErrorResponse(err, `Failed to set default agent: ${id}`)
  }
}
