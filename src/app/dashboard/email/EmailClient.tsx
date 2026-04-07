"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import {
  Mail,
  Clock,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowRight,
  Terminal,
  Loader2,
  CircleDot,
  CalendarClock,
  Power,
  Wrench,
  Activity,
  ShieldCheck,
  TriangleAlert,
  Zap,
  Bot,
  PlugZap,
  ChevronDown,
  ChevronUp,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CronJob, CronRun } from "@/lib/types";
import { Skill } from "@/lib/skills";

interface EmailStats {
  totalRuns: number;
  successRuns: number;
  errorRuns: number;
  runsToday: number;
  avgDurationMs: number | null;
}

interface EmailData {
  cron: CronJob | null;
  runs: CronRun[];
  himalayaSkill: Skill | null;
  agentConfig: { id: string; name: string } | null;
  gatewayOnline: boolean;
  stats: EmailStats;
  account: string;
  fetchedAt: string;
}

interface Props {
  initial: EmailData;
}

function timeSince(dateOrMs: string | number | null): string {
  if (!dateOrMs) return "—";
  try {
    const d = typeof dateOrMs === "number" ? new Date(dateOrMs) : new Date(dateOrMs);
    if (isNaN(d.getTime())) return String(dateOrMs);
    const secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  } catch {
    return String(dateOrMs);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function RunRow({ run }: { run: CronRun }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!run.summary || !!run.error;

  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all ${
        run.status === "error"
          ? "border-red-500/20 bg-red-500/5"
          : "border-emerald-500/20 bg-emerald-500/5"
      }`}
    >
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => hasDetail && setExpanded((v) => !v)}
        disabled={!hasDetail}
      >
        {run.status === "ok" ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <TriangleAlert className="w-4 h-4 text-red-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-semibold ${
                run.status === "ok" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {run.status === "ok" ? "Success" : "Error"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">{run.jobId}</span>
          </div>
          {run.summary && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{run.summary}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatDuration(run.durationMs)}</span>
          <span>{timeSince(run.ts)}</span>
          {hasDetail && (
            expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
          )}
        </div>
      </button>

      {expanded && hasDetail && (
        <div className="px-4 pb-3 space-y-2 border-t border-border/30 pt-3">
          {run.summary && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Summary
              </p>
              <p className="text-xs font-mono bg-muted p-2 rounded border">{run.summary}</p>
            </div>
          )}
          {run.error && (
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">
                Error
              </p>
              <p className="text-xs font-mono bg-red-500/10 border border-red-500/20 p-2 rounded text-red-300 break-all">
                {run.error}
              </p>
            </div>
          )}
          {run.usage && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>↑ {run.usage.input_tokens.toLocaleString()} tok</span>
              <span>↓ {run.usage.output_tokens.toLocaleString()} tok</span>
              {run.model && <span className="font-mono">{run.model}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmailClient({ initial }: Props) {
  const [data, setData] = useState<EmailData>(initial);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [, startTransition] = useTransition();

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/email", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json: EmailData = await res.json();
      startTransition(() => setData(json));
    } catch (err) {
      if (!silent)
        showToast(err instanceof Error ? err.message : "Failed to refresh", "err");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => refresh(true), 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function doAction(
    action: string,
    opts: { cronId?: string } = {}
  ) {
    setActionLoading(action);
    try {
      const res = await fetch("/api/email/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...opts }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Action failed");

      const successMsg: Record<string, string> = {
        "run-cron": "✓ Cron triggered — ClawBot is processing emails via Himalaya skill",
        "enable-cron": "✓ Cron enabled",
        "disable-cron": "✓ Cron disabled",
        "check-skill": json.found
          ? `✓ Himalaya skill found (${json.enabled ? "enabled" : "disabled"})`
          : "⚠ Himalaya skill not found in OpenClaw",
      };
      showToast(successMsg[action] ?? "Done", "ok");
      setTimeout(() => refresh(true), 1500);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed", "err");
    } finally {
      setActionLoading(null);
    }
  }

  const { cron, runs, himalayaSkill, stats } = data;

  const successRate =
    stats.totalRuns > 0
      ? Math.round((stats.successRuns / stats.totalRuns) * 100)
      : null;

  return (
    <div className="flex-1 flex flex-col gap-6 p-4 md:p-8 pt-6 min-h-0">
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all duration-300 max-w-sm ${
            toast.type === "ok"
              ? "bg-emerald-950 border-emerald-700 text-emerald-300"
              : "bg-red-950 border-red-700 text-red-300"
          }`}
        >
          {toast.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="line-clamp-3">{toast.msg}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Email Processing
          </h2>
          <p className="text-muted-foreground mt-1 text-sm flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            <span className="font-mono">{data.account}</span>
            <span className="mx-1 text-border">·</span>
            ClawBot + Himalaya skill via OpenClaw
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Skill pill */}
          <div
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
              himalayaSkill?.enabled
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : himalayaSkill
                ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                : "text-muted-foreground bg-muted border-border"
            }`}
          >
            <Wrench className="w-3 h-3" />
            {himalayaSkill
              ? himalayaSkill.enabled
                ? "Himalaya Skill Active"
                : "Himalaya Skill Disabled"
              : "Himalaya Skill Not Found"}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh(false)}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Total Runs",
            value: stats.totalRuns,
            icon: Hash,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
          },
          {
            label: "Today",
            value: stats.runsToday,
            icon: CalendarClock,
            color: "text-violet-400",
            bg: "bg-violet-500/10",
          },
          {
            label: "Success Rate",
            value: successRate !== null ? `${successRate}%` : "—",
            icon: Activity,
            color: successRate !== null && successRate >= 80 ? "text-emerald-400" : "text-amber-400",
            bg: successRate !== null && successRate >= 80 ? "bg-emerald-500/10" : "bg-amber-500/10",
          },
          {
            label: "Avg Duration",
            value: stats.avgDurationMs ? formatDuration(stats.avgDurationMs) : "—",
            icon: Zap,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-card p-4 flex items-center gap-3 shadow-sm"
          >
            <div className={`${s.bg} p-2 rounded-lg shrink-0`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{s.label}</p>
              <p className={`text-lg font-bold ${s.color} truncate`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">

        {/* ── Run History ── */}
        <div className="lg:col-span-2 rounded-xl border bg-card shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Processing Run History</span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {runs.length} run{runs.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {runs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <Terminal className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-medium text-sm">No runs recorded yet</p>
                  <p className="text-muted-foreground text-xs mt-1 max-w-xs">
                    {cron
                      ? "Trigger the cron manually or wait for the next scheduled run."
                      : "Create an email processing cron job first, then run it."}
                  </p>
                </div>
                {!cron && (
                  <div className="w-full max-w-xs rounded-lg bg-muted border p-3 font-mono text-xs text-left text-muted-foreground">
                    openclaw cron add email-inbox \<br />
                    &nbsp;&nbsp;--schedule &quot;*/15 * * * *&quot; \<br />
                    &nbsp;&nbsp;--agent clawbot \<br />
                    &nbsp;&nbsp;--message &quot;Check inbox for agent@tbs-marketing.com&quot;
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((run, i) => (
                  <RunRow key={`${run.jobId}-${run.ts}-${i}`} run={run} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div className="flex flex-col gap-4">

          {/* Cron Control Card */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Cron Job</span>
              </div>
              {cron && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                    cron.enabled
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : "text-muted-foreground bg-muted border-border"
                  }`}
                >
                  {cron.enabled ? "Active" : "Disabled"}
                </span>
              )}
            </div>

            <div className="p-4 space-y-3 text-sm">
              {cron ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">
                      Job
                    </p>
                    <p className="font-mono text-xs bg-muted px-2 py-1.5 rounded border truncate">
                      {cron.name}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">
                        Schedule
                      </p>
                      <p className="font-mono text-xs">{cron.schedule}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{cron.scheduleDescription}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">
                        Next Run
                      </p>
                      <p className="text-xs">{cron.nextRun ? timeSince(cron.nextRun) : "—"}</p>
                    </div>
                  </div>

                  {cron.lastRun && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">
                        Last Run
                      </p>
                      <div className="flex items-center gap-1.5">
                        {cron.status === "error" ? (
                          <TriangleAlert className="w-3 h-3 text-red-400" />
                        ) : (
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        )}
                        <p className="text-xs">{timeSince(cron.lastRun)}</p>
                        {cron.lastDurationMs && (
                          <span className="text-xs text-muted-foreground">
                            ({formatDuration(cron.lastDurationMs)})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {cron.payloadMessage && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">
                        Agent Prompt
                      </p>
                      <p className="text-xs bg-muted p-2 rounded border font-mono text-muted-foreground line-clamp-3">
                        {cron.payloadMessage}
                      </p>
                    </div>
                  )}

                  {cron.lastError && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                      <p className="text-xs text-red-400 font-mono break-all line-clamp-3">
                        {cron.lastError}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-4 text-center">
                  <CircleDot className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No email cron configured.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Use the OpenClaw CLI to create one.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t p-3 flex flex-col gap-2">
              <Button
                size="sm"
                className="w-full gap-2"
                disabled={!cron || actionLoading === "run-cron"}
                onClick={() => cron && doAction("run-cron", { cronId: cron.id })}
              >
                {actionLoading === "run-cron" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Run Now
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  disabled={!cron || cron.enabled || actionLoading === "enable-cron"}
                  onClick={() => cron && doAction("enable-cron", { cronId: cron.id })}
                >
                  {actionLoading === "enable-cron" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Power className="w-3 h-3" />
                  )}
                  Enable
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  disabled={!cron || !cron.enabled || actionLoading === "disable-cron"}
                  onClick={() => cron && doAction("disable-cron", { cronId: cron.id })}
                >
                  {actionLoading === "disable-cron" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Power className="w-3 h-3" />
                  )}
                  Disable
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-xs"
                disabled={actionLoading === "check-skill"}
                onClick={() => doAction("check-skill")}
              >
                {actionLoading === "check-skill" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <PlugZap className="w-3 h-3" />
                )}
                Verify Himalaya Skill
              </Button>
            </div>
          </div>

          {/* Skill Info Card */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/20">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                Himalaya Skill
              </h4>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Source</span>
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border">
                  {himalayaSkill?.source ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                {himalayaSkill ? (
                  himalayaSkill.enabled ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> Enabled
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <AlertCircle className="w-3 h-3" /> Disabled
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertCircle className="w-3 h-3" /> Not found
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Agent</span>
                <div className="flex items-center gap-1 text-xs">
                  <Bot className="w-3 h-3 text-primary" />
                  {data.agentConfig?.name ?? cron?.agentId ?? "clawbot"}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Account</span>
                <span className="font-mono text-xs truncate max-w-[140px]">{data.account}</span>
              </div>
              {himalayaSkill?.description && (
                <p className="text-xs text-muted-foreground border-t pt-3 leading-relaxed">
                  {himalayaSkill.description}
                </p>
              )}
            </div>
          </div>

          {/* How It Works */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-300/80 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-blue-300 mb-2">
              <Info className="w-3.5 h-3.5" />
              How this works
            </div>
            {[
              "Cron fires on schedule (e.g. every 15 min)",
              "OpenClaw wakes ClawBot with a prompt",
              "ClawBot uses the Himalaya skill for IMAP",
              "Emails parsed → tasks routed to Kanban",
              "Run history logged here automatically",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 shrink-0 mt-0.5 text-blue-400/60" />
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="h-2" />
    </div>
  );
}
