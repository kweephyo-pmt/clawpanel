import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'

function resolveAgentWorkspaceDir(id: string): string | null {
  const bin = process.env.OPENCLAW_BIN
  if (bin) {
    try {
      const raw = execSync(`${bin} agents list --json`, {
        encoding: 'utf-8',
        timeout: 8000,
      })
      const summaries = JSON.parse(raw) as Array<{
        id: string
        workspace: string
        identityName?: string
        identityEmoji?: string
      }>
      const match = summaries.find(a => a.id === id)
      if (match) return match.workspace
    } catch {}
  }
  return process.env.WORKSPACE_PATH ?? null
}

// GET /api/agents/[id]/identity
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get identity name/emoji from CLI first
    let cliName: string | null = null
    let cliEmoji: string | null = null

    const bin = process.env.OPENCLAW_BIN
    if (bin) {
      try {
        const raw = execSync(`${bin} agents list --json`, {
          encoding: 'utf-8',
          timeout: 8000,
        })
        const summaries = JSON.parse(raw) as Array<{
          id: string
          identityName?: string
          identityEmoji?: string
        }>
        const match = summaries.find(a => a.id === id)
        if (match) {
          cliName = match.identityName ?? null
          cliEmoji = match.identityEmoji ?? null
        }
      } catch {}
    }

    // Also try IDENTITY.md for more detail
    let name = cliName ?? id
    let emoji = cliEmoji ?? '🤖'
    let avatar = ''

    const workspaceDir = resolveAgentWorkspaceDir(id)
    if (workspaceDir) {
      const identityPath = join(workspaceDir, 'IDENTITY.md')
      if (existsSync(identityPath)) {
        const content = readFileSync(identityPath, 'utf-8')
        const nameMatch = content.match(/\*\*Name:\*\*\s*(.+)/i) ?? content.match(/^-\s+Name:\s*(.+)/mi)
        const emojiMatch = content.match(/\*\*Emoji:\*\*\s*(\S+)/i) ?? content.match(/^-\s+Emoji:\s*(\S+)/mi)
        const avatarMatch = content.match(/\*\*Avatar:\*\*\s*(.+)/i) ?? content.match(/^-\s+Avatar:\s*(.+)/mi)
        if (nameMatch) name = nameMatch[1].trim()
        if (emojiMatch) emoji = emojiMatch[1].trim()
        if (avatarMatch) avatar = avatarMatch[1].trim()
      }
    }

    return NextResponse.json({ agentId: id, name, emoji, avatar })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to fetch identity')
  }
}
