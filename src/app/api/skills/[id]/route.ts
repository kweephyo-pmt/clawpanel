import { apiErrorResponse } from '@/lib/api-error'
import { gatewayRpc } from '@/lib/gateway-rpc'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/skills/[id]
 * Body: { enabled: boolean }
 *
 * Calls the OpenClaw gateway `skills.update` RPC which persists the change
 * to the openclaw config file on the VPS.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = (await req.json()) as { enabled?: boolean }

    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) is required' }, { status: 400 })
    }

    await gatewayRpc('skills.update', {
      skillKey: id,
      enabled: body.enabled,
    })

    return NextResponse.json({ ok: true, skillKey: id, enabled: body.enabled })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update skill')
  }
}
