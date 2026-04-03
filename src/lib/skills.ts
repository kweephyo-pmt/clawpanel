import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'fs'
import { dirname, join } from 'path'

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
  /** 'workspace' = user's custom skill, 'bundled' = ships with openclaw package */
  source: 'workspace' | 'bundled'
}

// ---------------------------------------------------------------------------
// Frontmatter helpers
// ---------------------------------------------------------------------------

function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
  return match ? match[1] : null
}

function parseName(frontmatter: string): string | null {
  const m = frontmatter.match(/^name:\s*(.+)$/m)
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null
}

function parseDescription(frontmatter: string): string | null {
  // description may be quoted and can span multiple lines if it starts with " or '
  const m = frontmatter.match(/^description:\s*"([\s\S]*?)(?:"\s*(?:\n|$))/m)
    ?? frontmatter.match(/^description:\s*'([\s\S]*?)(?:'\s*(?:\n|$))/m)
    ?? frontmatter.match(/^description:\s*(.+)$/m)
  return m ? m[1].trim() : null
}

function parseHomepage(frontmatter: string): string | null {
  const m = frontmatter.match(/^homepage:\s*(.+)$/m)
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null
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

// ---------------------------------------------------------------------------
// Directory scanner
// ---------------------------------------------------------------------------

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
    const name = parseName(fm) ?? entry
    const description = parseDescription(fm) ?? 'An OpenClaw skill.'
    const homepage = parseHomepage(fm)

    skills.push({
      id: entry,
      name,
      description,
      emoji: extractEmoji(content),
      homepage,
      requiredBins: extractRequiredBins(content),
      install: extractInstall(content),
      source,
    })
  }
  return skills
}

// ---------------------------------------------------------------------------
// Locate the openclaw package root from OPENCLAW_BIN
// ---------------------------------------------------------------------------

function findOpenclawPackageRoot(binPath: string): string | null {
  try {
    // Resolve symlinks to find the real file (e.g. /usr/lib/node_modules/openclaw/openclaw.mjs)
    const realBin = realpathSync(binPath)
    // The binary (openclaw.mjs) sits directly at the package root
    const packageRoot = dirname(realBin)
    const pkgFile = join(packageRoot, 'package.json')
    if (existsSync(pkgFile)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgFile, 'utf-8')) as { name?: string }
        if (pkg.name === 'openclaw') return packageRoot
      } catch { /* continue to walk */ }
    }
    // Fallback: walk up a few levels (handles symlink → bin/openclaw → ../../openclaw.mjs patterns)
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all skills from:
 *   1. $WORKSPACE_PATH/skills/<name>/SKILL.md  — user workspace skills
 *   2. <openclaw-package-root>/skills/<name>/SKILL.md — bundled package skills
 *
 * Workspace skills take precedence; duplicates (same id) are deduplicated.
 */
export function loadSkills(): Skill[] {
  const workspacePath = process.env.WORKSPACE_PATH ?? ''
  const openclawBin = process.env.OPENCLAW_BIN ?? ''

  // 1. Workspace skills
  const workspaceSkills = workspacePath
    ? readSkillsFromDir(join(workspacePath, 'skills'), 'workspace')
    : []

  // 2. Bundled package skills
  let bundledSkills: Skill[] = []
  if (openclawBin) {
    const pkgRoot = findOpenclawPackageRoot(openclawBin)
    if (pkgRoot) {
      bundledSkills = readSkillsFromDir(join(pkgRoot, 'skills'), 'bundled')
    }
  }

  // Merge: workspace wins on id collision
  const seen = new Set<string>(workspaceSkills.map(s => s.id))
  const merged = [
    ...workspaceSkills,
    ...bundledSkills.filter(s => !seen.has(s.id)),
  ]

  return merged.sort((a, b) => a.id.localeCompare(b.id))
}
