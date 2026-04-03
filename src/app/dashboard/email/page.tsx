import { Mail, Clock, ShieldCheck, Power, Settings2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmailProcessingPage() {
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
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="p-6 border-b flex justify-between items-center bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-md">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Inbox Polling Cron</h3>
                  <p className="text-xs text-muted-foreground">Executes himalaya inbox check natively on the orchestrator</p>
                </div>
              </div>
              <span className="flex items-center text-xs font-medium text-green-500 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5"/> Active
              </span>
            </div>
            
            <div className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule</p>
                   <p className="font-mono text-sm">*/10 * * * * <span className="text-muted-foreground text-xs font-sans">(Every 10 min)</span></p>
                 </div>
                 <div className="space-y-1">
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Agent</p>
                   <p className="text-sm font-medium">Main Orchestrator</p>
                 </div>
               </div>

               <div className="space-y-1 pt-4 border-t border-border/50">
                 <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Execution Prompt</p>
                 <div className="bg-muted p-3 flex rounded-md font-mono text-xs text-muted-foreground border mt-2">
                   "Check the inbox using the Himalaya skill. Read any new, unread emails. If there are attachments, download and extract them securely to the workspace processing queue. Summarize what was received."
                 </div>
               </div>
            </div>
            <div className="p-4 bg-muted/30 border-t flex gap-2 justify-end">
              <Button variant="outline" size="sm"><Power className="w-4 h-4 mr-2" /> Disable Cron</Button>
              <Button variant="secondary" size="sm"><Settings2 className="w-4 h-4 mr-2" /> Edit Prompt</Button>
              <Button size="sm"><Play className="w-4 h-4 mr-2" /> Run Now</Button>
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
                 <span className="text-muted-foreground">Account</span>
                 <span className="font-medium">agent@tbs-marketing.com</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">Skill Binding</span>
                 <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">himalaya.md</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">Attachment Extract</span>
                 <span className="text-green-500 font-medium font-mono text-xs">Enabled</span>
               </div>
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
