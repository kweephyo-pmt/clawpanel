"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import {
  Mail,
  MailOpen,
  Clock,
  Play,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Info,
  Inbox,
  ArrowRight,
  Terminal,
  Loader2,
  CircleDot,
  CalendarClock,
  PlugZap,
  Trash2,
  Search,
  Filter,
  ChevronRight,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CronJob } from "@/lib/types";

interface EmailAttachment {
  name: string;
  mime: string;
  size: number;
}

interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  fromName: string;
  date: string;
  flags: string[];
  isRead: boolean;
  isProcessed: boolean;
  preview: string;
  attachments: EmailAttachment[];
}

interface EmailData {
  cron: CronJob | null;
  emails: EmailMessage[];
  unreadCount: number;
  totalCount: number;
  himalayaAvailable: boolean;
  himalayaError: string | null;
  account: string;
  fetchedAt: string;
}

interface Props {
  initial: EmailData;
}

function timeSince(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  } catch {
    return dateStr;
  }
}

function initials(name: string): string {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_COLORS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-blue-600",
];

function avatarColor(from: string): string {
  let hash = 0;
  for (let i = 0; i < from.length; i++) hash = from.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function EmailClient({ initial }: Props) {
  const [data, setData] = useState<EmailData>(initial);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      setInitialLoading(false);
    }
  }, []);

  // Fetch inbox on mount, then auto-refresh every 60 seconds
  useEffect(() => {
    refresh(true);
    const id = setInterval(() => refresh(true), 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function doAction(
    action: string,
    options: { cronId?: string; messageId?: string } = {}
  ) {
    setActionLoading(action);
    try {
      const res = await fetch("/api/email/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...options }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Action failed");
      showToast(
        action === "run-cron"
          ? "Cron triggered successfully"
          : action === "test-connection"
          ? "Connection verified ✓"
          : action === "mark-read"
          ? "Marked as read"
          : "Done",
        "ok"
      );
      setTimeout(() => refresh(true), 1200);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Action failed", "err");
    } finally {
      setActionLoading(null);
    }
  }

  const filteredEmails = data.emails.filter(
    (e) =>
      !search ||
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      e.from.toLowerCase().includes(search.toLowerCase()) ||
      e.fromName.toLowerCase().includes(search.toLowerCase())
  );

  const selected = filteredEmails.find((e) => e.id === selectedId) ?? null;

  const { cron } = data;

  return (
    <div className="flex-1 flex flex-col gap-6 p-4 md:p-8 pt-6 min-h-0">
      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all duration-300 ${
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
          {toast.msg}
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
            {data.account}
            <span className="mx-1 text-border">·</span>
            via Himalaya skill + OpenClaw clawbot
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection pill */}
          <div
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
              data.himalayaAvailable
                ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                : "text-amber-400 bg-amber-500/10 border-amber-500/20"
            }`}
          >
            {data.himalayaAvailable ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {data.himalayaAvailable ? "Himalaya Connected" : "Himalaya Offline"}
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
            label: "Total in Inbox",
            value: data.totalCount,
            icon: Inbox,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
          },
          {
            label: "Unread",
            value: data.unreadCount,
            icon: Mail,
            color: "text-violet-400",
            bg: "bg-violet-500/10",
          },
          {
            label: "Cron Status",
            value: cron ? (cron.enabled ? "Active" : "Disabled") : "None",
            icon: CircleDot,
            color: cron?.enabled ? "text-emerald-400" : "text-muted-foreground",
            bg: cron?.enabled ? "bg-emerald-500/10" : "bg-muted/50",
          },
          {
            label: "Last Fetched",
            value: data.fetchedAt ? timeSince(data.fetchedAt) : "—",
            icon: CalendarClock,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-card p-4 flex items-center gap-3 shadow-sm"
          >
            <div className={`${s.bg} p-2. rounded-lg`}>
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

        {/* ── Inbox Panel ── */}
        <div className="lg:col-span-2 rounded-xl border bg-card shadow-sm flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b flex items-center gap-3 bg-muted/20 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-background border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                placeholder="Search inbox..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5" />
              Filter
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {filteredEmails.length} msg{filteredEmails.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Email List */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {initialLoading ? (
              /* ── Skeleton loading ── */
              <div className="overflow-y-auto flex-1 divide-y divide-border/50">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-muted shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-2 pt-0.5">
                      <div className="flex justify-between gap-2">
                        <div className="h-3 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-12 shrink-0" />
                      </div>
                      <div className="h-3 bg-muted/60 rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !data.himalayaAvailable ? (
              /* ── Setup Guide ── */
              <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Terminal className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Himalaya Not Detected</h3>
                  <p className="text-muted-foreground text-sm max-w-sm">
                    Install and configure the Himalaya CLI email client to enable inbox fetching for{" "}
                    <span className="font-mono text-primary text-xs">agent@tbs-marketing.com</span>.
                  </p>
                </div>
                <div className="w-full max-w-sm space-y-2 text-left">
                  {[
                    { step: "1", label: "Install Himalaya", cmd: "cargo install himalaya" },
                    { step: "2", label: "Configure account", cmd: "himalaya account configure" },
                    { step: "3", label: "Add cron in openclaw", cmd: "openclaw cron add email-check ..." },
                  ].map((s) => (
                    <div key={s.step} className="rounded-lg border bg-muted/30 p-3 flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                        {s.step}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{s.label}</p>
                        <p className="font-mono text-xs text-muted-foreground truncate mt-0.5">{s.cmd}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {data.himalayaError && (
                  <div className="w-full max-w-sm rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-left">
                    <p className="text-xs font-semibold text-red-400 mb-1">Error detail</p>
                    <p className="font-mono text-xs text-red-300/70 break-all">{data.himalayaError.slice(0, 240)}</p>
                  </div>
                )}
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <Inbox className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">
                  {search ? "No messages match your search" : "Inbox is empty"}
                </p>
                {search && (
                  <Button variant="ghost" size="sm" onClick={() => setSearch("")}>Clear search</Button>
                )}
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                {filteredEmails.map((email) => {
                  const isOpen = selectedId === email.id;
                  return (
                    <div key={email.id} className="border-b border-border/50">
                      {/* Row */}
                      <button
                        onClick={() => setSelectedId(isOpen ? null : email.id)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors group ${
                          isOpen ? "bg-primary/5 border-l-2 border-primary" : ""
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(email.from)} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5`}
                        >
                          {initials(email.fromName || email.from)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={`text-sm truncate ${
                              !email.isRead ? "font-semibold" : "font-medium text-muted-foreground"
                            }`}>
                              {email.fromName || email.from}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                              {timeSince(email.date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {!email.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                            <p className="text-xs text-muted-foreground truncate">
                              {email.preview && email.preview !== email.subject
                                ? email.preview
                                : email.subject}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {!email.isRead && (
                            <button
                              onClick={(ev) => { ev.stopPropagation(); doAction("mark-read", { messageId: email.id }); }}
                              title="Mark as read"
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            >
                              <MailOpen className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(ev) => { ev.stopPropagation(); doAction("delete", { messageId: email.id }); }}
                            title="Delete"
                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                            isOpen ? "rotate-90" : ""
                          }`} />
                        </div>
                      </button>

                      {/* Inline expanded preview */}
                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 bg-primary/5 border-l-2 border-primary">
                          <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                            <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate">{email.subject}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  From: <span className="font-mono">{email.from}</span>
                                </p>
                              </div>
                              <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                                {email.flags.map((f) => (
                                  <span key={f} className="px-1.5 py-0.5 rounded text-xs bg-muted border font-mono">
                                    {f.replace("\\", "")}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="p-3">
                              <div className="rounded bg-muted/60 p-3 text-xs text-muted-foreground font-mono max-h-40 overflow-y-auto leading-relaxed">
                                {email.preview ||
                                  "Full message body requires himalaya read <id>. Use the OpenClaw agent to process this email."}
                              </div>

                              {/* Attachments */}
                              {email.attachments && email.attachments.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1">
                                    <Paperclip className="w-3 h-3" />
                                    {email.attachments.length} attachment{email.attachments.length !== 1 ? "s" : ""}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {email.attachments.map((att, i) => (
                                      <div
                                        key={i}
                                        className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-muted/40 text-xs max-w-[200px]"
                                        title={att.name}
                                      >
                                        <Paperclip className="w-3 h-3 shrink-0 text-muted-foreground" />
                                        <span className="truncate font-mono text-[10px]">{att.name}</span>
                                        {att.size > 0 && (
                                          <span className="shrink-0 text-muted-foreground text-[10px]">
                                            {att.size < 1024
                                              ? `${att.size}B`
                                              : att.size < 1048576
                                              ? `${(att.size / 1024).toFixed(0)}KB`
                                              : `${(att.size / 1048576).toFixed(1)}MB`}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2 mt-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs gap-1.5 h-7"
                                  onClick={() => doAction("mark-read", { messageId: email.id })}
                                  disabled={email.isRead || actionLoading === "mark-read"}
                                >
                                  <MailOpen className="w-3 h-3" />
                                  {email.isRead ? "Already Read" : "Mark Read"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs gap-1.5 h-7"
                                  onClick={() => { doAction("delete", { messageId: email.id }); setSelectedId(null); }}
                                  disabled={actionLoading === "delete"}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── Right Panel ── */}
        <div className="flex flex-col gap-4">

          {/* Cron Card */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Processing Cron</span>
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
                      Job Name
                    </p>
                    <p className="font-mono text-xs bg-muted px-2 py-1 rounded border truncate">
                      {cron.name}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">
                        Schedule
                      </p>
                      <p className="font-mono text-xs">{cron.schedule}</p>
                      <p className="text-xs text-muted-foreground">{cron.scheduleDescription}</p>
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
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            cron.status === "error" ? "bg-red-500" : "bg-emerald-500"
                          }`}
                        />
                        <p className="text-xs">{timeSince(cron.lastRun)}</p>
                        {cron.lastDurationMs && (
                          <span className="text-xs text-muted-foreground">
                            ({(cron.lastDurationMs / 1000).toFixed(1)}s)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {cron.lastError && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2">
                      <p className="text-xs text-red-400 font-mono break-all">
                        {cron.lastError.slice(0, 120)}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-4 text-center">
                  <CalendarClock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    No email processing cron found.
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Create one with the OpenClaw CLI.
                  </p>
                  <div className="mt-3 rounded-lg bg-muted p-2 font-mono text-xs text-left text-muted-foreground border">
                    openclaw cron add email-check \<br />
                    &nbsp;&nbsp;--schedule &quot;*/15 * * * *&quot; \<br />
                    &nbsp;&nbsp;--agent clawbot
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
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
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                disabled={actionLoading === "test-connection"}
                onClick={() => doAction("test-connection")}
              >
                {actionLoading === "test-connection" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PlugZap className="w-3.5 h-3.5" />
                )}
                Test Connection
              </Button>
            </div>
          </div>

          {/* Inbox Status Card */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-muted/20">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                Inbox Details
              </h4>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Account</span>
                <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border">
                  {data.account}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Himalaya Skill</span>
                {data.himalayaAvailable ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Not detected
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Protocol</span>
                <span className="text-xs font-medium">IMAP / SMTP</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Agent</span>
                <span className="text-xs font-medium">
                  {cron?.agentId ?? "clawbot"}
                </span>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-300/80 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-blue-300 mb-1">
              <Info className="w-3.5 h-3.5" />
              How this works
            </div>
            {[
              "Clawbot runs on a cron schedule",
              "Uses the Himalaya skill to fetch emails",
              "Processes attachments & routes tasks",
              "Results posted to the team Kanban",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 shrink-0 mt-0.5 text-blue-400/60" />
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* bottom padding */}
      <div className="h-2" />
    </div>
  );
}
