export const dynamic = 'force-dynamic';

import { loadSkillsAsync } from '@/lib/skills';
import SkillsClient from './SkillsClient';

export default async function SkillsPage() {
  const skills = await loadSkillsAsync();

  return <SkillsClient initialSkills={skills} />;
}
