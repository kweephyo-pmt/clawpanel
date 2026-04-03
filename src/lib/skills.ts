import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

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
}

/**
 * Parses a simple YAML-like block between --- delimiters.
 * Handles string values (quoted or bare), nested objects, and arrays.
 * This is a lightweight parser tuned for the openclaw SKILL.md frontmatter shape.
 */
function parseFrontmatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = raw.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (!kvMatch) { i++; continue }

    const key = kvMatch[1]
    const valRaw = kvMatch[2].trim()

    if (valRaw === '' || valRaw === '{') {
      // Could be a multi-line object/array — skip deep parsing, handled below
      i++
      continue
    }

    // Strip surrounding quotes
    const stripped = valRaw.replace(/^["']|["']$/g, '')
    result[key] = stripped
    i++
  }

  return result
}

/**
 * Extracts the YAML frontmatter block (between first and second ---) from a markdown file.
 */
function extractFrontmatter(content: string): string | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
  return match ? match[1] : null
}

/**
 * Extracts the emoji from the openclaw metadata JSON blob embedded in the frontmatter.
 * The metadata field uses JSON5-like syntax; we use a targeted regex instead of a full parser.
 */
function extractEmoji(content: string): string {
  const match = content.match(/"emoji":\s*"([^"]+)"/)
  return match ? match[1] : '🔧'
}

/**
 * Extracts required binaries from the metadata JSON blob.
 * Looks for: "bins": ["curl", ...]
 */
function extractRequiredBins(content: string): string[] {
  const match = content.match(/"requires"[\s\S]*?"bins":\s*\[([^\]]+)\]/)
  if (!match) return []
  return match[1]
    .split(',')
    .map(s => s.replace(/["'\s]/g, ''))
    .filter(Boolean)
}

/**
 * Extracts install options from the metadata JSON blob.
 */
function extractInstall(content: string): SkillInstall[] {
  const match = content.match(/"install":\s*\[([\s\S]*?)\],\s*\}/)
  if (!match) return []
  const block = match[1]
  const entries: SkillInstall[] = []

  // Each install option is a { ... } block
  const objects = block.match(/\{[\s\S]*?\}/g) || []
  for (const obj of objects) {
    const getField = (field: string) => {
      const m = obj.match(new RegExp(`"${field}":\\s*"([^"]+)"`))
      return m ? m[1] : undefined
    }
    const getBins = () => {
      const m = obj.match(/"bins":\s*\[([^\]]+)\]/)
      if (!m) return []
      return m[1].split(',').map(s => s.replace(/["'\s]/g, '')).filter(Boolean)
    }

    const id = getField('id')
    if (!id) continue
    entries.push({
      id,
      kind: getField('kind') ?? '',
      label: getField('label') ?? '',
      formula: getField('formula'),
      package: getField('package'),
      bins: getBins(),
    })
  }

  return entries
}

/**
 * Reads all openclaw skills from the workspace's skills/ directory.
 * Each skill is a subdirectory containing a SKILL.md file.
 */
export function loadSkills(): Skill[] {
  const workspacePath = process.env.WORKSPACE_PATH ?? ''
  if (!workspacePath) return []

  const skillsDir = join(workspacePath, 'skills')
  if (!existsSync(skillsDir)) return []

  let entries: string[]
  try {
    entries = readdirSync(skillsDir).filter(name => {
      try {
        return statSync(join(skillsDir, name)).isDirectory()
      } catch {
        return false
      }
    })
  } catch {
    return []
  }

  const skills: Skill[] = []

  for (const entry of entries) {
    const skillFile = join(skillsDir, entry, 'SKILL.md')
    if (!existsSync(skillFile)) continue

    let content: string
    try {
      content = readFileSync(skillFile, 'utf-8')
    } catch {
      continue
    }

    const frontmatterRaw = extractFrontmatter(content)
    const fm = frontmatterRaw ? parseFrontmatter(frontmatterRaw) : {}

    const name = String(fm.name ?? entry)
    const description = String(fm.description ?? '').replace(/^["']|["']$/g, '') || 'An OpenClaw skill.'
    const homepage = fm.homepage ? String(fm.homepage) : null

    skills.push({
      id: entry,
      name,
      description,
      emoji: extractEmoji(content),
      homepage,
      requiredBins: extractRequiredBins(content),
      install: extractInstall(content),
    })
  }

  return skills.sort((a, b) => a.id.localeCompare(b.id))
}
