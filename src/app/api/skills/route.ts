import { apiErrorResponse } from '@/lib/api-error'
import { gatewayRpc } from '@/lib/gateway-rpc'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Shape returned by the gateway `skills.status` RPC */
interface GatewaySkillEntry {
  name: string
  description: string
  source: string
  bundled: boolean
  skillKey: string
  emoji?: string
  homepage?: string
  disabled: boolean
  eligible: boolean
  install: Array<{
    id: string
    kind: string
    label: string
    bins: string[]
  }>
}

interface GatewaySkillStatusReport {
  skills: GatewaySkillEntry[]
}

export async function GET() {
  try {
    const report = await gatewayRpc<GatewaySkillStatusReport>('skills.status', {})
    const skills = (report.skills ?? []).map((s) => ({
      id: s.skillKey ?? s.name,
      name: s.name,
      description: s.description,
      emoji: s.emoji ?? '🔧',
      homepage: s.homepage ?? null,
      requiredBins: [] as string[],
      install: (s.install ?? []).map((opt) => ({
        id: opt.id,
        kind: opt.kind,
        label: opt.label,
        bins: opt.bins,
      })),
      source: s.bundled ? 'bundled' : 'workspace',
      // real gateway fields:
      disabled: s.disabled,
      eligible: s.eligible,
    }))
    return NextResponse.json(skills)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load skills from gateway')
  }
}
