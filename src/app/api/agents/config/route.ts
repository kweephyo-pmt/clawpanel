import { NextResponse } from 'next/server'
import { fetchFromOpenClaw } from '@/lib/openclaw'
import { apiErrorResponse } from '@/lib/api-error'

// GET /api/agents/config - full gateway config
// PUT /api/agents/config - save config
export async function GET() {
  try {
    const data = await fetchFromOpenClaw('/api/config')
    return NextResponse.json(data)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch config')
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json() as Record<string, unknown>
    const data = await fetchFromOpenClaw('/api/config', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    return NextResponse.json(data)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to save config')
  }
}
