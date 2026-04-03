"use client";

import { useEffect, useState } from "react";
import { loadTickets, type KanbanStore } from "@/lib/kanban/store";
import { Button } from "@/components/ui/button";

export default function KanbanPage() {
  const [store, setStore] = useState<KanbanStore>({});

  useEffect(() => {
    setStore(loadTickets());
  }, []);

  const tickets = Object.values(store);
  const backlog = tickets.filter(t => t.status === "backlog" || t.status === "todo");
  const processing = tickets.filter(t => t.status === "in-progress");
  const review = tickets.filter(t => t.status === "review");
  const complete = tickets.filter(t => t.status === "done");

  const RenderColumn = ({ title, color, items }: { title: string, color?: string, items: any[] }) => (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col h-[650px]">
      <div className="p-4 border-b flex-shrink-0 flex justify-between items-center bg-muted/20">
        <h3 className={`font-semibold ${color || ''}`}>{title}</h3>
        <span className="text-xs bg-muted/50 px-2.5 py-1 rounded-full">{items.length}</span>
      </div>
      <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-muted/5">
        {items.map(t => (
          <div key={t.id} className="p-3 border rounded-lg bg-card shadow-sm text-sm">
            <p className="font-medium mb-1">{t.title}</p>
            {t.assigneeId && <span className="text-xs text-muted-foreground mr-2">🤖 {t.assigneeId}</span>}
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${t.priority === 'high' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>{t.priority}</span>
          </div>
        ))}
        {items.length === 0 && <div className="text-muted-foreground text-sm text-center py-6 opacity-60">No tasks</div>}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Task Kanban</h2>
          <p className="text-muted-foreground mt-1 text-sm">Monitor agent task execution flows.</p>
        </div>
        <Button>+ Add Task</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 min-h-0">
        <RenderColumn title="Tasks" items={backlog} />
        <RenderColumn title="Processing" color="text-amber-500" items={processing} />
        <RenderColumn title="Review" color="text-purple-500" items={review} />
        <RenderColumn title="Complete" color="text-green-500" items={complete} />
      </div>
    </div>
  );
}
