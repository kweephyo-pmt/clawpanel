export const dynamic = 'force-dynamic';

import EmailClient from './EmailClient';
import { getCrons } from '@/lib/crons';
import { serverLoadTickets } from '@/lib/kanban/server-store';
import type { EmailPageData, EmailProject } from '@/app/api/email/route';

export default async function EmailProcessingPage() {
  const allCrons = await getCrons().catch(() => []);
  const emailCron = allCrons.find(c => c.name === 'email-processor') ?? null;

  const store = serverLoadTickets();
  const allTickets = Object.values(store);

  const emailTickets = allTickets.filter(t => t?.title && t.title.startsWith('📧'));
  const otherTickets = allTickets.filter(t => !t?.title || !t.title.startsWith('📧'));

  const projects: EmailProject[] = emailTickets
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20)
    .map(ticket => {
      const subject = ticket.title.replace(/^📧\s*/, '').trim();
      const subTaskCount = otherTickets.filter(
        t => (t?.description || '').includes(subject) || (t?.description || '').includes(ticket.id)
      ).length;

      return {
        id: ticket.id,
        title: ticket.title,
        subject,
        description: ticket.description || '',
        status: ticket.status || 'todo',
        priority: ticket.priority || 'medium',
        workState: ticket.workState || 'idle',
        createdAt: ticket.createdAt || Date.now(),
        updatedAt: ticket.updatedAt || Date.now(),
        subTaskCount,
      };
    });

  const activeProjects = projects.filter(
    p => p.status === 'in-progress' || p.status === 'todo'
  ).length;
  const completedProjects = projects.filter(p => p.status === 'done').length;

  const initial: EmailPageData = {
    cron: emailCron,
    recentCrons: allCrons.slice(0, 5),
    projects,
    totalProjects: emailTickets.length,
    activeProjects,
    completedProjects,
  };

  return <EmailClient initial={initial} />;
}
