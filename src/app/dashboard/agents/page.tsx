export const dynamic = 'force-dynamic';

import { loadRegistry } from "@/lib/agents-registry";
import AgentsClient from "./AgentsClient";

export default async function AgentsPage() {
  const agents = loadRegistry();
  return <AgentsClient initialAgents={agents} />;
}
