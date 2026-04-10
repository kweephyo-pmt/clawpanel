import { NextResponse } from 'next/server'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { apiErrorResponse } from '@/lib/api-error'
import { loadRegistry } from '@/lib/agents-registry'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspacePath = process.env.WORKSPACE_PATH
    const agents = loadRegistry()
    const agent = agents.find(a => a.id === id)
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (!agent.soulPath || !workspacePath) {
      return NextResponse.json({ content: null, path: null })
    }

    const fullPath = join(workspacePath, agent.soulPath)
    if (!existsSync(fullPath)) {
      return NextResponse.json({ content: null, path: agent.soulPath })
    }

    const content = readFileSync(fullPath, 'utf-8')
    return NextResponse.json({ content, path: agent.soulPath })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load SOUL.md')
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workspacePath = process.env.WORKSPACE_PATH
    const agents = loadRegistry()
    const agent = agents.find(a => a.id === id)
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    if (!agent.soulPath || !workspacePath) {
      return NextResponse.json({ error: 'No SOUL.md path for this agent' }, { status: 400 })
    }

    const { content } = await req.json() as { content: string }
    const fullPath = join(workspacePath, agent.soulPath)
    writeFileSync(fullPath, content, 'utf-8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to save SOUL.md')
  }
}
