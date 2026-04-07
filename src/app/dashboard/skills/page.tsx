export const dynamic = 'force-dynamic';

import { loadSkills } from '@/lib/skills';
import SkillsClient from './SkillsClient';

export default async function SkillsPage() {
  const skills = loadSkills();

  return <SkillsClient initialSkills={skills} />;
}
