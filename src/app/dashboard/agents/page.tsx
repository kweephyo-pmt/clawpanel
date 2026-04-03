export const dynamic = 'force-dynamic';

import { loadRegistry } from "@/lib/agents-registry";
import { Bot, Settings, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function AgentsPage() {
  const agents = loadRegistry() || [];

  return (
    <div className="flex-1 space-y-6 flex flex-col p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Active Agents</h2>
          <p className="text-muted-foreground mt-1 text-sm">Deploy and manage your OpenClaw worker cluster.</p>
        </div>
        <Button>+ Spawn New Agent</Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <div key={agent.id} className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col">
            <div className="p-6 pb-4 flex items-start justify-between border-b border-border/50 bg-muted/20">
              <div className="flex items-center gap-3">
                <div 
                  className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-xl shadow-inner border border-white/10"
                  style={{ backgroundColor: agent.color || '#3b82f6' }}
                >
                  {agent.emoji || '🤖'}
                </div>
                <div>
                  <h3 className="font-semibold leading-none">{agent.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{agent.title}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 flex-1 space-y-4">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {agent.description}
              </p>
              
              <div className="flex items-center gap-2 text-xs font-medium bg-muted/50 w-fit px-2.5 py-1 rounded-md">
                <Settings className="w-3.5 h-3.5 text-primary" />
                {agent.model || "Default Model"}
              </div>
            </div>

            <div className="p-6 pt-0 mt-auto flex items-center gap-2">
              <Button variant="secondary" className="flex-1 text-xs">Edit Config</Button>
              <Button variant="outline" size="icon" className="shrink-0"><ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground">No Agents Discovered</h3>
            <p className="max-w-sm mx-auto mt-2">OpenClaw could not find any agents in the specified workspace path.</p>
          </div>
        )}
      </div>
    </div>
  );
}
