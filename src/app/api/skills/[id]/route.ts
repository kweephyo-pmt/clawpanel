import { loadSkillsAsync } from '@/lib/skills'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const skills = await loadSkillsAsync()
    const skill = skills.find(s => s.id === id)
    if (!skill || !existsSync(skill.path)) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    const content = readFileSync(skill.path, 'utf-8')
    return NextResponse.json({ content })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to read skill')
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { content } = await request.json()

    if (typeof content !== 'string') {
       return NextResponse.json({ error: 'Content must be a string' }, { status: 400 })
    }

    const skills = await loadSkillsAsync()
    const skill = skills.find(s => s.id === id)
    
    if (!skill || !existsSync(skill.path)) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    writeFileSync(skill.path, content, 'utf-8')
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update skill')
  }
}