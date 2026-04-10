import { NextResponse } from 'next/server'
import { fetchFromOpenClaw } from '@/lib/openclaw'
import { apiErrorResponse } from '@/lib/api-error'

// GET /api/agents/[id]/files  - list files for an agent
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await fetchFromOpenClaw(`/api/agents/${id}/files`)
    return NextResponse.json(data)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch agent files')
  }
}
