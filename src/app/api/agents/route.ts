import { loadRegistry } from '@/lib/agents-registry'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const agents = loadRegistry()
    return NextResponse.json(agents)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load agents')
  }
}
