export const dynamic = 'force-dynamic';

import { loadSkills } from '@/lib/skills';
import { Wrench, Terminal, ExternalLink, Package, Search } from 'lucide-react';

export default async function SkillsPage() {
  const skills = loadSkills();

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 pt-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Skills</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {skills.length} skill{skills.length !== 1 ? 's' : ''} available in your OpenClaw workspace.
          </p>
        </div>
      </div>

      {/* Grid */}
      {skills.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {skills.map((skill) => (
            <div
              key={skill.id}
              className="group relative rounded-xl border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
            >
              {/* Top accent bar */}
              <div className="h-0.5 w-full bg-gradient-to-r from-primary/60 to-primary/10" />

              <div className="p-5 flex flex-col gap-3 flex-1">
                {/* Emoji + Name row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-2xl w-9 h-9 flex items-center justify-center rounded-lg bg-muted border"
                      role="img"
                      aria-label={skill.name}
                    >
                      {skill.emoji}
                    </span>
                    <div>
                      <h3 className="font-semibold text-sm leading-tight">{skill.name}</h3>
                      <span className="text-xs text-muted-foreground font-mono">{skill.id}</span>
                    </div>
                  </div>
                  {skill.homepage && (
                    <a
                      href={skill.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                      title="Homepage"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                  {skill.description}
                </p>

                {/* Required bins */}
                {skill.requiredBins.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
                    {skill.requiredBins.map((bin) => (
                      <span
                        key={bin}
                        className="inline-flex items-center gap-1 text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-md border"
                      >
                        <Terminal className="w-2.5 h-2.5" />
                        {bin}
                      </span>
                    ))}
                  </div>
                )}

                {/* Install options count */}
                {skill.install.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="w-3 h-3" />
                    <span>
                      {skill.install.length} install option{skill.install.length !== 1 ? 's' : ''}
                      {' '}({skill.install.map(i => i.kind).join(', ')})
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center text-muted-foreground">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="w-6 h-6 opacity-50" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No Skills Found</h3>
          <p className="text-sm max-w-xs">
            Make sure <code className="text-xs bg-muted px-1.5 py-0.5 rounded">WORKSPACE_PATH</code> is set and points to your OpenClaw workspace directory.
          </p>
          <p className="text-xs mt-3 opacity-60">
            Expected layout: <code className="bg-muted px-1.5 py-0.5 rounded">$WORKSPACE_PATH/skills/&lt;name&gt;/SKILL.md</code>
          </p>
        </div>
      )}
    </div>
  );
}
