import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { apiErrorResponse } from '@/lib/api-error'

const execAsync = promisify(exec)

async function resolveAgentWorkspaceDir(id: string): Promise<string | null> {
  const bin = process.env.OPENCLAW_BIN
  if (bin) {
    try {
      const { stdout: raw } = await execAsync(`${bin} agents list --json`, {
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
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const qsWorkspace = searchParams.get('workspace')

    // Get identity name/emoji from CLI first (skip if we got workspace already, or we can fetch only once)
    let cliName: string | null = null
    let cliEmoji: string | null = null

    // We skip the CLI if qsWorkspace is provided because we only need it for the workspace path usually,
    // but the CLI *also* provides identityName. The UI passes `agent.identityName` and `agent.identityEmoji`
    // from the main list anyway, so we just need the local filesystem parses here!

    // Also try IDENTITY.md for more detail
    let name = id
    let emoji = '🤖'
    let avatar = ''

    const workspaceDir = qsWorkspace || await resolveAgentWorkspaceDir(id)
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
