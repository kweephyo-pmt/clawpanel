import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

const ACCOUNT = 'agent@tbs-marketing.com'
const TIMEOUT = 8000

function tryRun(cmd: string): { ok: boolean; out: string } {
  try {
    const out = execSync(cmd, { encoding: 'utf-8', timeout: TIMEOUT })
    return { ok: true, out }
  } catch (e) {
    return { ok: false, out: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const forceId = searchParams.get('id')

  // Step 1: get first email id
  let emailId = forceId ?? ''
  let listResult: unknown = null

  if (!emailId) {
    const listTry = [
      `himalaya -a "${ACCOUNT}" envelope list --output json --page-size 1`,
      `himalaya envelope list --output json --page-size 1`,
    ]
    for (const cmd of listTry) {
      const r = tryRun(cmd)
      if (r.ok) {
        try {
          const parsed = JSON.parse(r.out)
          listResult = parsed
          const list: unknown[] = Array.isArray(parsed)
            ? parsed
            : (parsed?.response ?? parsed?.data ?? [])
          const first = list[0] as Record<string, unknown> | undefined
          emailId = String(first?.id ?? first?.uid ?? first?.seq ?? '')
        } catch {
          listResult = r.out
        }
        break
      } else {
        listResult = { error: r.out }
      }
    }
  }

  if (!emailId) {
    return NextResponse.json({ error: 'No email id found', listResult }, { status: 500 })
  }

  // Step 2: read the email
  const reads: Record<string, unknown> = {}
  for (const cmd of [
    `himalaya -a "${ACCOUNT}" message read "${emailId}" --output json`,
    `himalaya message read "${emailId}" --output json`,
  ]) {
    const r = tryRun(cmd)
    try { reads[cmd] = r.ok ? JSON.parse(r.out) : { error: r.out } }
    catch { reads[cmd] = r.out }
  }

  // Step 3: attachment list
  const attachResults: Record<string, unknown> = {}
  for (const cmd of [
    `himalaya -a "${ACCOUNT}" message attachment list "${emailId}" --output json`,
    `himalaya -a "${ACCOUNT}" attachment list "${emailId}" --output json`,
  ]) {
    const r = tryRun(cmd)
    try { attachResults[cmd] = r.ok ? JSON.parse(r.out) : { error: r.out } }
    catch { attachResults[cmd] = r.out }
  }

  return NextResponse.json({ emailId, listResult, reads, attachResults })
}
