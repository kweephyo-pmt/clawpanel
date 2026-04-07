export const dynamic = 'force-dynamic';

import EmailClient from './EmailClient';
import { getCrons } from '@/lib/crons';
import { execSync } from 'child_process';

export default async function EmailProcessingPage() {
  // Fetch cron jobs for the email processor
  const crons = await getCrons().catch(() => []);
  const emailCron = crons.find(
    c =>
      c.name.toLowerCase().includes('email') ||
      c.name.toLowerCase().includes('himalaya') ||
      c.name.toLowerCase().includes('inbox'),
  ) ?? null;

  // Check himalaya availability without throwing
  let himalayaAvailable = false;
  let himalayaError: string | null = null;
  try {
    execSync('himalaya --version', { encoding: 'utf-8', timeout: 5000 });
    himalayaAvailable = true;
  } catch (err) {
    himalayaError = err instanceof Error ? err.message : String(err);
  }

  const initial = {
    cron: emailCron,
    emails: [],
    unreadCount: 0,
    totalCount: 0,
    himalayaAvailable,
    himalayaError,
    account: 'agent@tbs-marketing.com',
    fetchedAt: new Date().toISOString(),
  };

  return <EmailClient initial={initial} />;
}
