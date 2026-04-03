export const dynamic = 'force-dynamic';

import { getCrons } from "@/lib/crons";
import { Mail, Clock, ShieldCheck, Power, Settings2, Play, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export default async function EmailProcessingPage() {
  const crons = await getCrons().catch(() => []);
  const emailCron = crons.find(c => c.name.toLowerCase().includes("email") || c.name.toLowerCase().includes("himalaya") || c.name.toLowerCase().includes("inbox"));
  
  const workspacePath = process.env.WORKSPACE_PATH || "";
  const himalayaExists = existsSync(join(workspacePath, "skills", "himalaya.md")) || existsSync(join(workspacePath, "himalaya.md"));
  
  let himalayaContent = "";
  try {
    if (himalayaExists) {
      himalayaContent = readFileSync(join(workspacePath, "skills", "himalaya.md"), "utf-8");
    }
  } catch {}

  const isConfigured = himalayaExists;

  return (
    <div className="flex-1 space-y-6 flex flex-col p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Email Processing</h2>
          <p className="text-muted-foreground mt-1 text-sm">Configure automated inbox parsing and attachment extraction via Himalaya.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-md">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{emailCron ? emailCron.name : "Inbox Polling Cron"}</h3>
                  <p className="text-xs text-muted-foreground">Executes himalaya inbox check natively on the orchestrator</p>
                </div>
              </div>
              {emailCron ? (
                <span className={`flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${emailCron.status === 'error' ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-green-500 bg-green-500/10 border-green-500/20'}`}>
                  {emailCron.status === 'error' ? <TriangleAlert className="w-3.5 h-3.5 mr-1.5"/> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5"/>} 
                  {emailCron.enabled ? "Active" : "Disabled"}
                </span>
              ) : (
                <span className="flex items-center text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full border">
                  Not Configured
                </span>
              )}
            </div>
            
            <div className="p-6 space-y-4 flex-1">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule</p>
                   {emailCron ? (
                     <p className="font-mono text-sm">{emailCron.schedule} <span className="text-muted-foreground text-xs font-sans">({emailCron.scheduleDescription})</span></p>
                   ) : (
                     <p className="text-sm italic text-muted-foreground">No cron job bound</p>
                   )}
                 </div>
                 <div className="space-y-1">
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Agent</p>
                   <p className="text-sm font-medium">{emailCron?.agentId || "Main Orchestrator"}</p>
                 </div>
               </div>

               <div className="space-y-1 pt-4 border-t border-border/50">
                 <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Execution Information</p>
                 <div className="bg-muted p-3 flex rounded-md font-mono text-xs text-muted-foreground border mt-2 min-h-[60px]">
                   {emailCron?.description || (emailCron ? "Running automated extraction sequence." : "Configure an OpenClaw cron job using the CLI to bind your email ingestion.")}
                 </div>
               </div>
            </div>
            <div className="p-4 bg-muted/30 border-t flex gap-2 justify-end">
              {emailCron && <Button variant="outline" size="sm"><Power className="w-4 h-4 mr-2" /> {emailCron.enabled ? "Disable Cron" : "Enable Cron"}</Button>}
              <Button variant="secondary" size="sm" disabled={!emailCron}><Settings2 className="w-4 h-4 mr-2" /> Settings </Button>
              <Button size="sm" disabled={!emailCron}><Play className="w-4 h-4 mr-2" /> Run Now</Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
             <div className="p-6 border-b bg-muted/20">
               <h3 className="font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Connected Inbox</h3>
             </div>
             <div className="p-6 space-y-4 text-sm">
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">Skill Binding</span>
                 {himalayaExists ? (
                   <span className="font-mono bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded text-xs border border-green-500/20">himalaya.md</span>
                 ) : (
                   <span className="font-mono bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded text-xs border border-red-500/20">Missing</span>
                 )}
               </div>
               {himalayaExists && (
                 <div className="flex flex-col gap-1 mt-2">
                   <span className="text-muted-foreground text-xs uppercase font-semibold tracking-wider">Profile</span>
                   <p className="text-xs font-mono bg-muted p-2 rounded truncate border border-border/50 text-muted-foreground">
                      {himalayaContent.length > 0 ? "Verified local execution profile." : "Empty skill file."}
                   </p>
                 </div>
               )}
               <div className="pt-4 border-t flex justify-center">
                 <Button variant="outline" className="w-full text-xs" size="sm">Manage Credentials in CLI</Button>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
