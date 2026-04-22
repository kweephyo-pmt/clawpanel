import { NextResponse } from 'next/server'
import { rmSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'
import { apiErrorResponse } from '@/lib/api-error'
import { namedAgentDir } from '@/lib/agents-registry'

/**
 * Remove an agent from `agents.list` in openclaw.json.
 */
function unregisterAgentFromConfig(id: string): void {
  const configPath = join(homedir(), '.openclaw', 'openclaw.json')
  if (!existsSync(configPath)) return

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const cfg = JSON.parse(raw)
    
    if (Array.isArray(cfg?.agents?.list)) {
      const initialLength = cfg.agents.list.length
      cfg.agents.list = cfg.agents.list.filter((a: any) => a.id !== id)
      
      // Only write if we actually removed something
      if (cfg.agents.list.length < initialLength) {
        writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8')
      }
    }
  } catch (e) {
    console.warn(`Failed to unregister agent ${id} from config:`, e)
  }
}

// DELETE /api/agents/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (id === 'main') {
      return NextResponse.json({ error: 'Cannot delete the main orchestrator agent.' }, { status: 403 })
    }

    // 1. Delete from agentDir (where ClawPanel creates agents)
    const agentDir = namedAgentDir(id)
    if (existsSync(agentDir)) {
      rmSync(agentDir, { recursive: true, force: true })
    }

    // 2. Also try to delete from workspace if it exists there
    const workspacePath = process.env.WORKSPACE_PATH
    if (workspacePath) {
      const workspaceAgentDir = join(workspacePath, 'agents', id)
      if (existsSync(workspaceAgentDir)) {
        rmSync(workspaceAgentDir, { recursive: true, force: true })
      }
    }

    // 3. Unregister from openclaw.json
    unregisterAgentFromConfig(id)

    // 4. Try to reload the openclaw gateway config to reflect the deletion
    const bin = process.env.OPENCLAW_BIN || 'openclaw'
    try {
      execSync(`${bin} config reload`, { encoding: 'utf-8', timeout: 5000, stdio: 'ignore' })
    } catch (e) {
      console.warn('config reload failed after delete:', e)
    }

    return NextResponse.json({ ok: true, deletedId: id })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to delete agent')
  }
}
