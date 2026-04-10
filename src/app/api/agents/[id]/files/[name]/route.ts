import { NextResponse } from 'next/server'
import { fetchFromOpenClaw } from '@/lib/openclaw'
import { apiErrorResponse } from '@/lib/api-error'

// GET  /api/agents/[id]/files/[name] - get file content
// PUT  /api/agents/[id]/files/[name] - save file content
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  try {
    const { id, name } = await params
    const data = await fetchFromOpenClaw(`/api/agents/${id}/files/${encodeURIComponent(name)}`)
    return NextResponse.json(data)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch file content')
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; name: string }> }
) {
  try {
    const { id, name } = await params
    const body = await req.json() as { content: string }
    const data = await fetchFromOpenClaw(`/api/agents/${id}/files/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify({ content: body.content }),
    })
    return NextResponse.json(data)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to save file content')
  }
}
