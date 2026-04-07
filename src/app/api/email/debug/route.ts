import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

const ACCOUNT = 'agent@tbs-marketing.com'

function run(cmd: string): { ok: true; out: string } | { ok: false; err: string } {
  try {
    const out = execSync(cmd, { encoding: 'utf-8', timeout: 15000 })
    return { ok: true, out }
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  let id = searchParams.get('id')

  const results: Record<string, unknown> = {}

  // If no id given, list emails first and pick the first one
  if (!id) {
    const listCmds = [
      `himalaya -a "${ACCOUNT}" envelope list --output json --page-size 5`,
      `himalaya -a "${ACCOUNT}" list --output json --page-size 5`,
      `himalaya envelope list --output json --page-size 5`,
    ]
    for (const cmd of listCmds) {
      const r = run(cmd)
      if (r.ok) {
        try {
          const parsed = JSON.parse(r.out)
          const list: unknown[] = Array.isArray(parsed)
            ? parsed
            : parsed.response ?? parsed.data ?? []
          results['list_raw'] = list
          const first = list[0] as Record<string, unknown> | undefined
          if (first) {
            id = String(first.id ?? first.uid ?? first.seq ?? '')
            results['auto_picked_id'] = id
          }
        } catch {
          results['list_raw_text'] = r.out
        }
        break
      }
    }
  }

  if (!id) {
    return NextResponse.json(
      { error: 'Could not determine email id. Pass ?id=<message_id> explicitly.', ...results },
      { status: 400 }
    )
  }

  // Try all known read + attachment list variants
  const cmds = [
    `himalaya -a "${ACCOUNT}" message read "${id}" --output json`,
    `himalaya -a "${ACCOUNT}" read "${id}" --output json`,
    `himalaya -a "${ACCOUNT}" message attachment list "${id}" --output json`,
    `himalaya -a "${ACCOUNT}" attachment list "${id}" --output json`,
    `himalaya message read "${id}" --output json`,
    `himalaya attachment list "${id}" --output json`,
  ]

  for (const cmd of cmds) {
    const result = run(cmd)
    if (result.ok) {
      try {
        results[cmd] = JSON.parse(result.out)
      } catch {
        results[cmd] = result.out
      }
    } else {
      results[cmd] = { error: result.err }
    }
  }

  return NextResponse.json(results, { status: 200 })
}
