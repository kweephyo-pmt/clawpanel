import { NextResponse } from 'next/server'
import { fetchFromOpenClaw } from '@/lib/openclaw'
import { apiErrorResponse } from '@/lib/api-error'

export async function GET() {
  try {
    const data = await fetchFromOpenClaw('/api/channels/status')
    return NextResponse.json(data)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch channels status')
  }
}
