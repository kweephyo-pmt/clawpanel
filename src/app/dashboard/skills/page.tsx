export const dynamic = 'force-dynamic';

import { gatewayRpc } from '@/lib/gateway-rpc'
import type { Skill } from '@/lib/skills'
import SkillsClient from './SkillsClient'

interface GatewaySkill extends Skill {
  disabled: boolean
  eligible: boolean
}

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
  install: Array<{ id: string; kind: string; label: string; bins: string[] }>
}

interface GatewaySkillStatusReport {
  skills: GatewaySkillEntry[]
}

async function loadSkillsFromGateway(): Promise<GatewaySkill[]> {
  try {
    const report = await gatewayRpc<GatewaySkillStatusReport>('skills.status', {})
    return (report.skills ?? []).map((s) => ({
      id: s.skillKey ?? s.name,
      name: s.name,
      description: s.description,
      emoji: s.emoji ?? '🔧',
      homepage: s.homepage ?? null,
      requiredBins: [],
      install: (s.install ?? []).map((opt) => ({
        id: opt.id,
        kind: opt.kind,
        label: opt.label,
        formula: undefined,
        package: undefined,
        bins: opt.bins,
      })),
      source: s.bundled ? 'bundled' : 'workspace',
      disabled: s.disabled,
      eligible: s.eligible,
    }))
  } catch (err) {
    console.error('[SkillsPage] Failed to load skills from gateway:', err)
    return []
  }
}

export default async function SkillsPage() {
  const skills = await loadSkillsFromGateway()
  return <SkillsClient initialSkills={skills} />
}
