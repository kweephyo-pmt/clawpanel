import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

// GET /api/agents/config  - openclaw config show --json
export async function GET() {
  const bin = process.env.OPENCLAW_BIN
  if (!bin) {
    return NextResponse.json({ error: 'OPENCLAW_BIN not set' }, { status: 503 })
  }
  try {
    const raw = execSync(`${bin} config show --json`, {
      encoding: 'utf-8',
      timeout: 10000,
    })
    const data: unknown = JSON.parse(raw)
    return NextResponse.json(data)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load config')
  }
}

// PUT is not supported without gateway WebSocket — stub it
export async function PUT() {
  return NextResponse.json(
    { error: 'Config writes require the gateway WebSocket protocol. Use the openclaw CLI.' },
    { status: 501 }
  )
}
