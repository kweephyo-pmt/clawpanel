import { redirect } from 'next/navigation';

export default function DashboardOverview() {
  redirect('/dashboard/agents');
}
