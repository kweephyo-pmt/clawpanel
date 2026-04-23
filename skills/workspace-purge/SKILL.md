---
name: workspace-purge
description: Periodically purge old task-output markdown files (research, drafts, reports, writing output) from the agent workspace. Protects memories, skills, identity, and config files. Runs automatically via cron every 1–3 months.

emoji: 🧹
openclaw:
  skillKey: workspace-purge
---

# workspace-purge — Workspace Cleanup

Purge old task-output files from the workspace to keep it clean.
Only removes clearly temporary outputs. Never touches memory, identity, or skills.

## When You Run This (cron or manual)

1. Use `find` to identify `.md` files older than 90 days in the target directories
2. Print the full list with dates
3. Count and summarize what will be deleted
4. Delete them using `rm` (or `trash-put` if available)
5. Log the result to `memory/YYYY-MM-DD.md`

## Target Locations (delete .md files here if older than 90 days)

```
output/         outputs/        research/
drafts/         draft/          reports/
writing/        content/        tasks/*.md
```

Loose `.md` files in the workspace root matching these patterns:
`*-research.md`, `*-report.md`, `*-draft.md`, `*-output.md`,
`*-writing.md`, `*-content.md`, `*-result.md`, `*-analysis.md`,
`*-audit.md`, `*-seo.md`, `*-keyword*.md`, `*-blog*.md`,
`*-article*.md`, `*-post*.md`, `*-email*.md`, `*-campaign*.md`, `*-copy*.md`

## NEVER Delete These

```
SOUL.md         AGENTS.md       TOOLS.md
IDENTITY.md     USER.md         MEMORY.md
MEMORY_GUIDE.md HEARTBEAT.md    BOOTSTRAP.md
README.md       CHANGELOG.md
tasks/task_index.json
tasks/task_check.sh
tasks/task_complete.sh
memory/         (entire directory)
skills/         (entire directory)
.agents/        (entire directory)
```

## Commands to Use

```bash
# Find candidates (dry run — list only)
find "$WORKSPACE_PATH/output" "$WORKSPACE_PATH/research" "$WORKSPACE_PATH/drafts" \
  "$WORKSPACE_PATH/reports" "$WORKSPACE_PATH/writing" "$WORKSPACE_PATH/content" \
  -maxdepth 2 -type f -name "*.md" -mtime +90 2>/dev/null

# Find tasks/*.md (exclude task_index.json)
find "$WORKSPACE_PATH/tasks" -maxdepth 1 -type f -name "*.md" -mtime +90 2>/dev/null

# Delete a file (prefer trash if available)
trash-put "$file" 2>/dev/null || rm "$file"
```

## Log Entry Format

After purging, append to today's memory file:

```
## Workspace Purge — YYYY-MM-DD
- Deleted N files older than 90 days
- Directories cleaned: output/, research/, drafts/
- Protected: memory/, skills/, identity files untouched
```
