import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

// GET /api/agents/channels  - openclaw channels status --json
export async function GET() {
  const bin = process.env.OPENCLAW_BIN
  if (!bin) {
    return NextResponse.json({  
      channelOrder: [],
      channelLabels: {},
      channelAccounts: {},
      error: 'OPENCLAW_BIN not set',
    })
  }
  try {
    const raw = execSync(`${bin} channels status --json`, {
      encoding: 'utf-8',
      timeout: 12000,
    })
    const data: unknown = JSON.parse(raw)
    return NextResponse.json(data)
  } catch {
    // channels status may not support --json yet, or gateway may be down
    return NextResponse.json({
      channelOrder: [],
      channelLabels: {},
      channelAccounts: {},
      error: 'Channels status unavailable. Ensure the gateway is running: openclaw gateway run',
    })
  }
}
