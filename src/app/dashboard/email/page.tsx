export const dynamic = 'force-dynamic';

import EmailClient from './EmailClient';
import { getCrons } from '@/lib/crons';
import { getCronRuns } from '@/lib/cron-runs';
import { loadSkills } from '@/lib/skills';

export default async function EmailProcessingPage() {
  // 1. Find email processing cron
  const crons = await getCrons().catch(() => []);
  const emailCron =
    crons.find(
      c =>
        c.name.toLowerCase().includes('email') ||
        c.name.toLowerCase().includes('himalaya') ||
        c.name.toLowerCase().includes('inbox'),
    ) ?? null;

  // 2. Load run history for this cron
  const runs = emailCron ? getCronRuns(emailCron.id).slice(0, 20) : [];

  // 3. Check if himalaya skill is available via OpenClaw skill system
  const skills = loadSkills();
  const himalayaSkill = skills.find(s => s.id === 'himalaya') ?? null;

  // 4. Build stats
  const successRuns = runs.filter(r => r.status === 'ok');
  const errorRuns = runs.filter(r => r.status === 'error');
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const runsToday = runs.filter(r => r.ts >= todayMidnight.getTime());
  const avgDurationMs =
    successRuns.length > 0
      ? Math.round(successRuns.reduce((s, r) => s + r.durationMs, 0) / successRuns.length)
      : null;

  const initial = {
    cron: emailCron,
    runs,
    himalayaSkill,
    agentConfig: emailCron?.agentId
      ? { id: emailCron.agentId, name: emailCron.agentId }
      : null,
    gatewayOnline: false, // checked client-side on demand
    stats: {
      totalRuns: runs.length,
      successRuns: successRuns.length,
      errorRuns: errorRuns.length,
      runsToday: runsToday.length,
      avgDurationMs,
    },
    account: 'agent@tbs-marketing.com',
    fetchedAt: new Date().toISOString(),
  };

  return <EmailClient initial={initial} />;
}
