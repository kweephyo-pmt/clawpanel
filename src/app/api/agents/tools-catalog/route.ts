import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// GET /api/agents/tools-catalog  - openclaw tools list --json
export async function GET() {
  const bin = process.env.OPENCLAW_BIN
  if (!bin) {
    return NextResponse.json({ groups: [], error: 'OPENCLAW_BIN not set' })
  }
  try {
    const { stdout: raw } = await execAsync(`${bin} tools list --json`, {
      encoding: 'utf-8',
      timeout: 10000,
    })
    const data: unknown = JSON.parse(raw)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ groups: [], error: 'Tools catalog not available' })
  }
}
