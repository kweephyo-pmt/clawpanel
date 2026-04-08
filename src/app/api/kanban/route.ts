import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import fs from 'node:fs'
import path from 'node:path'
import { requireEnv } from '@/lib/env'

import { homedir } from 'node:os'

function getStoreFilePath() {
    // Stored at ~/.clawpanel/kanban.json
    return path.join(homedir(), '.clawpanel', 'kanban.json');
}

function ensureDir() {
    const filePath = getStoreFilePath()
    const dirPath = path.dirname(filePath)
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
}

export async function GET() {
    try {
        const storePath = getStoreFilePath()
        if (!fs.existsSync(storePath)) {
            return NextResponse.json({})
        }
        const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
        return NextResponse.json(store)
    } catch (error) {
        console.error('Failed to load kanban store:', error)
        return NextResponse.json({}, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const incomingStore = await request.json()
        ensureDir()
        const storePath = getStoreFilePath()

        let mergedStore = incomingStore
        if (fs.existsSync(storePath)) {
            const currentStore = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
            mergedStore = { ...currentStore }
            for (const [id, ticket] of Object.entries(incomingStore)) {
                const currentTicket = currentStore[id]
                if (!currentTicket || ((ticket as any).updatedAt || 0) > (currentTicket.updatedAt || 0)) {
                    mergedStore[id] = ticket
                }
            }
        }

        fs.writeFileSync(storePath, JSON.stringify(mergedStore, null, 2))
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to save kanban store:', error)
        return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }
}
