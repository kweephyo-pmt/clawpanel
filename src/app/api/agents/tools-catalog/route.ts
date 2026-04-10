import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

// GET /api/agents/tools-catalog  - openclaw tools list --json
export async function GET() {
  const bin = process.env.OPENCLAW_BIN
  if (!bin) {
    return NextResponse.json({ groups: [], error: 'OPENCLAW_BIN not set' })
  }
  try {
    const raw = execSync(`${bin} tools list --json`, {
      encoding: 'utf-8',
      timeout: 10000,
    })
    const data: unknown = JSON.parse(raw)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ groups: [], error: 'Tools catalog not available' })
  }
}
