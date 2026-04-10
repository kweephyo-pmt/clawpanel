import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { loadRegistry, parseIdentity } from '@/lib/agents-registry'
import { apiErrorResponse } from '@/lib/api-error'

// GET /api/agents/[id]/identity
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspacePath = process.env.WORKSPACE_PATH

    const agents = loadRegistry()
    const agent = agents.find(a => a.id === id)

    let name = agent?.name ?? id
    let emoji = agent?.emoji ?? '🤖'
    let avatar = ''

    // Try reading IDENTITY.md for more detail
    if (workspacePath) {
      // Determine workspace dir
      let workspaceDir = workspacePath
      if (agent?.soulPath?.startsWith('agents/')) {
        const parts = agent.soulPath.split('/')
        if (parts.length >= 3) workspaceDir = join(workspacePath, parts[0], parts[1])
      }

      const identityPath = join(workspaceDir, 'IDENTITY.md')
      if (existsSync(identityPath)) {
        const content = readFileSync(identityPath, 'utf-8')
        const parsed = parseIdentity(content)
        if (parsed.name) name = parsed.name
        if (parsed.emoji) emoji = parsed.emoji
        // Try Avatar line
        const avatarMatch = content.match(/\*\*Avatar:\*\*\s*(.+)/i)
        if (avatarMatch) avatar = avatarMatch[1].trim()
      }
    }

    return NextResponse.json({ agentId: id, name, emoji, avatar })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch identity')
  }
}
