import { NextResponse } from 'next/server'
import { fetchFromOpenClaw } from '@/lib/openclaw'
import { apiErrorResponse } from '@/lib/api-error'

// GET /api/agents/tools-catalog
export async function GET() {
  try {
    const data = await fetchFromOpenClaw('/api/tools/catalog')
    return NextResponse.json(data)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch tools catalog')
  }
}
