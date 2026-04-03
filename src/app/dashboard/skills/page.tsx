import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Wrench, CheckCircle2, XCircle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function SkillsPage() {
  const workspacePath = process.env.WORKSPACE_PATH || "";
  const skillsDir = join(workspacePath, 'skills');
  let skills: { name: string; description: string; enabled: boolean }[] = [];

  if (existsSync(skillsDir)) {
    try {
      const files = readdirSync(skillsDir).filter(f => f.endsWith('.md'));
      skills = files.map(file => {
        const content = readFileSync(join(skillsDir, file), 'utf-8');
        // Simple extraction fallback since standard frontmatter varies
        const descMatch = content.match(/description:\s*(.+)/i) || content.match(/^#\s+.+\n+>?\s*(.+)/m);
        return {
          name: file.replace('.md', ''),
          description: descMatch ? descMatch[1].trim() : "Custom OpenClaw skill.",
          enabled: true // Usually implicit if file exists, disable could mean prepending _
        };
      });
    } catch {}
  }

  return (
    <div className="flex-1 space-y-6 flex flex-col p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">OpenClaw Skills</h2>
          <p className="text-muted-foreground mt-1 text-sm">Manage abilities and tools your agents can use.</p>
        </div>
        <Button>+ Register Skill</Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {skills.map((skill) => (
          <div key={skill.name} className="border rounded-xl bg-card shadow-sm p-6 flex flex-col justify-between hover:border-primary/30 transition-colors">
            <div>
               <div className="flex justify-between items-start mb-4">
                 <div className="bg-primary/10 p-3 rounded-lg border border-primary/20">
                   <Wrench className="w-5 h-5 text-primary" />
                 </div>
                 {skill.enabled ? (
                   <span className="flex items-center text-xs font-medium text-green-500 bg-green-500/10 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3 mr-1"/> Active</span>
                 ) : (
                   <span className="flex items-center text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full"><XCircle className="w-3 h-3 mr-1"/> Disabled</span>
                 )}
               </div>
               <h3 className="font-semibold text-lg">{skill.name}</h3>
               <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{skill.description}</p>
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" className="flex-1 text-xs h-9"><Settings2 className="w-3.5 h-3.5 mr-2" /> Edit</Button>
              <Button variant="outline" className="flex-1 text-xs h-9">{skill.enabled ? 'Disable' : 'Enable'}</Button>
            </div>
          </div>
        ))}

        {skills.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed py-16 text-center text-muted-foreground">
            <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground">No Skills Found</h3>
            <p className="max-w-sm mx-auto mt-2">OpenClaw has no custom `.md` skills registered in your workspace `skills/` directory.</p>
          </div>
        )}
      </div>
    </div>
  );
}
