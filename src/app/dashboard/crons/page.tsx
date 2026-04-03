import { getCrons } from "@/lib/crons";
import { Clock, Play, FileEdit, Trash2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function CronsPage() {
  const crons = await getCrons();

  return (
    <div className="flex-1 space-y-6 flex flex-col p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Crons Management</h2>
        <Button>+ New Cron</Button>
      </div>
      
      <div className="grid gap-4 bg-card rounded-xl border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b text-muted-foreground uppercase text-xs">
              <tr>
                <th className="px-6 py-4 font-medium">Cron Name</th>
                <th className="px-6 py-4 font-medium">Schedule</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Next Run</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {crons.map((cron) => (
                <tr key={cron.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4 font-medium flex items-center gap-3">
                    <Clock className="w-4 h-4 text-primary" />
                    {cron.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono bg-muted/40 px-2 py-1 rounded text-xs">{cron.schedule}</span>
                    <span className="ml-2 text-muted-foreground text-xs">{cron.scheduleDescription}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${cron.enabled ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {cron.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {cron.nextRun ? new Date(cron.nextRun).toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 flex items-center justify-end gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8"><Play className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8"><Power className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8"><FileEdit className="w-4 h-4" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
              {crons.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">No crons currently active.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
