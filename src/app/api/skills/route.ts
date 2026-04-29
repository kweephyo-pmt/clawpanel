import { loadSkillsAsync } from '@/lib/skills'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const skills = await loadSkillsAsync()
    return NextResponse.json(skills)
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load skills')
  }
}
