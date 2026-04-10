import { NextResponse } from 'next/server'
import { fetchFromOpenClaw } from '@/lib/openclaw'
import { apiErrorResponse } from '@/lib/api-error'

// GET  /api/agents/[id]/skills - skill status report for agent
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await fetchFromOpenClaw(`/api/agents/${id}/skills`)
    return NextResponse.json(data)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch agent skills')
  }
}
