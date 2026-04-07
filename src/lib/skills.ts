import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'fs'
import { execSync } from 'child_process'
import { dirname, join } from 'path'
import os from 'os'

export interface SkillInstall {
  id: string
  kind: string
  label: string
  formula?: string
  package?: string
  bins?: string[]
}

export interface Skill {
  id: string
  name: string
  description: string
  emoji: string
  homepage: string | null
  requiredBins: string[]
  install: SkillInstall[]
  /** 'workspace' = user's custom skill, 'bundled' = ships with openclaw, 'managed' = installed via skills install */
  source: 'workspace' | 'bundled' | 'managed'
  /** Whether the skill is enabled in openclaw config (undefined = not explicitly set, treated as enabled) */
  enabled?: boolean
}

// ---------------------------------------------------------------------------
// Primary: use `openclaw skills list --json` (covers all 3 directories)
// ---------------------------------------------------------------------------

interface CliSkill {
  name?: string
  description?: string
  emoji?: string
  homepage?: string
  source?: string
  disabled?: boolean
  eligible?: boolean
  skillKey?: string
  requirements?: { bins?: string[] }
  missing?: { bins?: string[] }
  install?: Array<{
    id?: string
    kind?: string
    label?: string
    formula?: string
    package?: string
    bins?: string[]
  }>
}

interface CliSkillsJson {
  skills?: CliSkill[]
}

function loadSkillsFromCli(openclawBin: string): Skill[] | null {
  try {
    const raw = execSync(`${openclawBin} skills list --json`, {
      encoding: 'utf-8',
      timeout: 15000,
      // Don't let stderr bubble up — treat any output as parse attempt
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Strip ANSI codes that may sneak through
    const clean = raw.replace(/\x1b\[[0-9;]*m/g, '').replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]/g, '')

    const parsed: CliSkillsJson = JSON.parse(clean)
    const skills: CliSkill[] = Array.isArray(parsed)
      ? (parsed as CliSkill[])
      : (parsed.skills ?? [])

    if (!Array.isArray(skills) || skills.length === 0) return null

    return skills.map((s): Skill => {
      const id = s.skillKey ?? s.name ?? ''
      const src = s.source ?? 'bundled'
      const source: Skill['source'] =
        src === 'workspace' ? 'workspace'
        : src === 'managed' || src === 'openclaw-managed' ? 'managed'
        : 'bundled'

      return {
        id,
        name: s.name ?? id,
        description: s.description ?? '',
        emoji: s.emoji ?? '🔧',
        homepage: s.homepage ?? null,
        requiredBins: s.requirements?.bins ?? s.missing?.bins ?? [],
        install: (s.install ?? []).map((opt, i) => ({
          id: opt.id ?? `opt-${i}`,
          kind: opt.kind ?? '',
          label: opt.label ?? '',
          formula: opt.formula,
          package: opt.package,
          bins: opt.bins,
        })),
        source,
        // disabled === true means enabled is false
        enabled: s.disabled === true ? false : undefined,
      }
    })
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Fallback: scan skill directories directly (original approach)
// ---------------------------------------------------------------------------

function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
  return match ? match[1] : null
}

function parseName(frontmatter: string): string | null {
  const m = frontmatter.match(/^name:\s*(.+)$/m)
  return m ? m[1].trim().replace(/^[\"']|[\"']$/g, '') : null
}

function parseDescription(frontmatter: string): string | null {
  const m = frontmatter.match(/^description:\s*"([\s\S]*?)(?:"\s*(?:\n|$))/m)
    ?? frontmatter.match(/^description:\s*'([\s\S]*?)(?:'\s*(?:\n|$))/m)
    ?? frontmatter.match(/^description:\s*(.+)$/m)
  return m ? m[1].trim() : null
}

function parseHomepage(frontmatter: string): string | null {
  const m = frontmatter.match(/^homepage:\s*(.+)$/m)
  return m ? m[1].trim().replace(/^[\"']|[\"']$/g, '') : null
}

function extractEmoji(content: string): string {
  const m = content.match(/"emoji":\s*"([^"]+)"/)
  return m ? m[1] : '🔧'
}

function extractRequiredBins(content: string): string[] {
  const m = content.match(/"requires"[\s\S]*?"bins":\s*\[([^\]]+)\]/)
  if (!m) return []
  return m[1].split(',').map(s => s.replace(/["'\s]/g, '')).filter(Boolean)
}

function extractInstall(content: string): SkillInstall[] {
  const m = content.match(/"install":\s*\[([\s\S]*?)\],?\s*\}/)
  if (!m) return []
  const block = m[1]
  const objects = block.match(/\{[\s\S]*?\}/g) ?? []
  return objects.flatMap(obj => {
    const getField = (field: string) => {
      const fm = obj.match(new RegExp(`"${field}":\\s*"([^"]+)"`))
      return fm ? fm[1] : undefined
    }
    const getBins = () => {
      const bm = obj.match(/"bins":\s*\[([^\]]+)\]/)
      if (!bm) return []
      return bm[1].split(',').map(s => s.replace(/["'\s]/g, '')).filter(Boolean)
    }
    const id = getField('id')
    if (!id) return []
    return [{
      id,
      kind: getField('kind') ?? '',
      label: getField('label') ?? '',
      formula: getField('formula'),
      package: getField('package'),
      bins: getBins(),
    }]
  })
}

function readSkillsFromDir(dir: string, source: Skill['source']): Skill[] {
  if (!existsSync(dir)) return []
  let entries: string[]
  try {
    entries = readdirSync(dir).filter(name => {
      try { return statSync(join(dir, name)).isDirectory() } catch { return false }
    })
  } catch {
    return []
  }

  const skills: Skill[] = []
  for (const entry of entries) {
    const skillFile = join(dir, entry, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    let content: string
    try { content = readFileSync(skillFile, 'utf-8') } catch { continue }
    const fm = extractFrontmatter(content) ?? ''
    skills.push({
      id: entry,
      name: parseName(fm) ?? entry,
      description: parseDescription(fm) ?? 'An OpenClaw skill.',
      emoji: extractEmoji(content),
      homepage: parseHomepage(fm),
      requiredBins: extractRequiredBins(content),
      install: extractInstall(content),
      source,
    })
  }
  return skills
}

function findOpenclawPackageRoot(binPath: string): string | null {
  try {
    const realBin = realpathSync(binPath)
    const packageRoot = dirname(realBin)
    const pkgFile = join(packageRoot, 'package.json')
    if (existsSync(pkgFile)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgFile, 'utf-8')) as { name?: string }
        if (pkg.name === 'openclaw') return packageRoot
      } catch { /* continue */ }
    }
    let dir = packageRoot
    for (let i = 0; i < 6; i++) {
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
      const pf = join(dir, 'package.json')
      if (existsSync(pf)) {
        try {
          const pkg = JSON.parse(readFileSync(pf, 'utf-8')) as { name?: string }
          if (pkg.name === 'openclaw') return dir
        } catch { /* keep walking */ }
      }
    }
  } catch { /* ignore */ }
  return null
}

function loadSkillsFallback(): Skill[] {
  const workspacePath = process.env.WORKSPACE_PATH ?? ''
  const openclawBin = process.env.OPENCLAW_BIN ?? ''
  const stateDir = process.env.OPENCLAW_STATE_DIR?.trim() || join(os.homedir(), '.openclaw')

  const workspaceSkills = workspacePath
    ? readSkillsFromDir(join(workspacePath, 'skills'), 'workspace')
    : []

  // Managed skills (~/.openclaw/skills/)
  const managedSkills = readSkillsFromDir(join(stateDir, 'skills'), 'managed')

  // Bundled skills (inside the openclaw package)
  let bundledSkills: Skill[] = []
  if (openclawBin) {
    const pkgRoot = findOpenclawPackageRoot(openclawBin)
    if (pkgRoot) {
      bundledSkills = readSkillsFromDir(join(pkgRoot, 'skills'), 'bundled')
    }
  }

  // Merge: workspace > managed > bundled on id collision
  const seen = new Set<string>()
  const merged: Skill[] = []
  for (const skill of [...workspaceSkills, ...managedSkills, ...bundledSkills]) {
    if (!seen.has(skill.id)) {
      seen.add(skill.id)
      merged.push(skill)
    }
  }
  return merged.sort((a, b) => a.id.localeCompare(b.id))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all skills. Uses `openclaw skills list --json` as the primary source
 * (covers workspace, managed/installed, and bundled skills). Falls back to
 * direct directory scanning if the CLI call fails.
 */
export function loadSkills(): Skill[] {
  const openclawBin = process.env.OPENCLAW_BIN ?? ''
  if (openclawBin) {
    const cliSkills = loadSkillsFromCli(openclawBin)
    if (cliSkills && cliSkills.length > 0) {
      return cliSkills.sort((a, b) => a.id.localeCompare(b.id))
    }
  }

  // Fallback: scan directories directly
  return loadSkillsFallback()
}
