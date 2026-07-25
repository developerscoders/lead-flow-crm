import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "motion/react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api, type Envelope, type Lead, type LeadStatus, type Paginated, type User } from "@/lib/api";
import { useRequireAuth, useMe } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PipelineRail } from "@/components/PipelineRail";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Pipeline — LeadFlow" },
      { name: "description", content: "Your team's live sales pipeline." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Pipeline — LeadFlow" },
      { property: "og:description", content: "Your team's live sales pipeline." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  useRequireAuth();
  const me = useMe();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [assignee, setAssignee] = useState<string>("all");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  // simple debounce
  useDebouncedEffect(() => setQDebounced(q), 250, [q]);

  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api<Envelope<User[]>>("/api/users")).data,
    enabled: !!me.data,
    staleTime: 60_000,
  });

  const leadsQ = useQuery({
    queryKey: ["leads", { page, status, assignee, q: qDebounced }],
    queryFn: async () =>
      api<Paginated<Lead>>("/api/leads", {
        query: {
          page,
          pageSize: 20,
          status: status === "all" ? undefined : status,
          assigneeId: assignee === "all" ? undefined : assignee === "unassigned" ? "unassigned" : assignee,
          q: qDebounced || undefined,
        },
      }),
    enabled: !!me.data,
    placeholderData: (prev) => prev,
  });

  const users = usersQ.data ?? [];
  const isAdmin = me.data?.role === "admin";

  if (!me.data) return null;

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-accent">Pipeline</div>
            <h1 className="font-serif text-4xl mt-1">Leads</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {leadsQ.data?.pagination.total ?? "—"} total · showing page {page}
            </p>
          </div>
        </header>

        {/* pipeline overview */}
        <div className="rounded-xl border bg-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
            Stages
          </div>
          <PipelineRail status={derivePrimaryStage(leadsQ.data?.data ?? [])} />
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
              placeholder="Search name, email, company…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setPage(1); setStatus(v); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={(v) => { setPage(1); setAssignee(v); }}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {(isAdmin ? users : users.filter((u) => u.id === me.data?.id)).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* table */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1.6fr_120px] gap-4 px-6 py-3 border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div>Lead</div>
            <div>Company</div>
            <div>Assignee</div>
            <div>Stage</div>
            <div className="text-right">Status</div>
          </div>

          {leadsQ.isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[1.4fr_1fr_1fr_1.6fr_120px] gap-4 px-6 py-4 items-center">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : leadsQ.error ? (
            <div className="px-6 py-16 text-center text-sm text-destructive">
              {(leadsQ.error as Error).message}
            </div>
          ) : (leadsQ.data?.data ?? []).length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="font-serif text-xl">No leads yet</div>
              <p className="mt-1 text-sm text-muted-foreground">
                New submissions from your capture form will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {leadsQ.data!.data.map((lead, i) => (
                <motion.li
                  key={lead.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                >
                  <Link
                    to="/leads/$id"
                    params={{ id: lead.id }}
                    className="grid grid-cols-[1.4fr_1fr_1fr_1.6fr_120px] gap-4 px-6 py-4 items-center hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{lead.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{lead.email}</div>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {lead.company || "—"}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {lead.assignee?.name ?? "Unassigned"}
                    </div>
                    <div>
                      <PipelineRail status={lead.status} size="sm" />
                    </div>
                    <div className="text-right">
                      <StatusPill status={lead.status} />
                    </div>
                  </Link>
                </motion.li>
              ))}
            </ul>
          )}

          {leadsQ.data && leadsQ.data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30 text-sm">
              <div className="text-muted-foreground">
                Page {leadsQ.data.pagination.page} of {leadsQ.data.pagination.totalPages}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage((p) => Math.min(leadsQ.data!.pagination.totalPages, p + 1))}
                  disabled={page >= leadsQ.data.pagination.totalPages}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function derivePrimaryStage(leads: Lead[]): LeadStatus {
  if (!leads.length) return "new";
  const counts: Record<string, number> = {};
  for (const l of leads) counts[l.status] = (counts[l.status] ?? 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return (top?.[0] as LeadStatus) ?? "new";
}

function StatusPill({ status }: { status: LeadStatus }) {
  const map: Record<LeadStatus, string> = {
    new: "bg-muted text-foreground",
    contacted: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    qualified: "bg-accent/20 text-accent-foreground",
    proposal: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    won: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
    lost: "bg-destructive/10 text-destructive",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider", map[status])}>
      {status}
    </span>
  );
}

import { useEffect, useRef } from "react";
function useDebouncedEffect(fn: () => void, delay: number, deps: React.DependencyList) {
  const cb = useRef(fn);
  cb.current = fn;
  useEffect(() => {
    const t = setTimeout(() => cb.current(), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
