import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Save, User as UserIcon, Clock, CircleDot, MessageSquarePlus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  ApiError,
  type Envelope,
  type LeadDetail,
  type LeadStatus,
  type User,
  type LeadActivity,
} from "@/lib/api";
import { useRequireAuth, useMe } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PipelineRail } from "@/components/PipelineRail";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leads/$id")({
  head: () => ({
    meta: [
      { title: "Lead — LeadFlow" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Lead detail and activity." },
      { property: "og:title", content: "Lead — LeadFlow" },
      { property: "og:description", content: "Lead detail and activity." },
    ],
  }),
  component: LeadPage,
});

function LeadPage() {
  useRequireAuth();
  const me = useMe();
  const { id } = useParams({ from: "/leads/$id" });
  const qc = useQueryClient();

  const leadQ = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => (await api<Envelope<LeadDetail>>(`/api/leads/${id}`)).data,
    enabled: !!me.data,
  });

  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api<Envelope<User[]>>("/api/users")).data,
    enabled: me.data?.role === "admin",
  });

  const [fields, setFields] = useState({ name: "", email: "", phone: "", company: "", message: "" });
  const [dirty, setDirty] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (leadQ.data) {
      setFields({
        name: leadQ.data.name ?? "",
        email: leadQ.data.email ?? "",
        phone: leadQ.data.phone ?? "",
        company: leadQ.data.company ?? "",
        message: leadQ.data.message ?? "",
      });
      setDirty(false);
    }
  }, [leadQ.data?.id]);

  const saveMut = useMutation({
    mutationFn: (body: typeof fields) =>
      api<Envelope<LeadDetail>>(`/api/leads/${id}`, { method: "PATCH", body }),
    onSuccess: (res) => {
      qc.setQueryData(["lead", id], res.data);
      setDirty(false);
      setFlash("Saved");
      setTimeout(() => setFlash(null), 1500);
    },
  });

  const statusMut = useMutation({
    mutationFn: (next: LeadStatus) =>
      api<Envelope<LeadDetail>>(`/api/leads/${id}/status`, { method: "POST", body: { status: next } }),
    onMutate: () => setStatusError(null),
    onSuccess: (res) => qc.setQueryData(["lead", id], res.data),
    onError: (e: unknown) => {
      if (e instanceof ApiError) setStatusError(e.message);
      else setStatusError("Could not update status");
    },
  });

  const assignMut = useMutation({
    mutationFn: (assigneeId: string | null) =>
      api<Envelope<LeadDetail>>(`/api/leads/${id}/assign`, {
        method: "POST",
        body: { assigneeId },
      }),
    onSuccess: (res) => qc.setQueryData(["lead", id], res.data),
  });

  const noteMut = useMutation({
    mutationFn: (body: string) =>
      api<Envelope<LeadDetail>>(`/api/leads/${id}/notes`, { method: "POST", body: { body } }),
    onSuccess: (res) => {
      qc.setQueryData(["lead", id], res.data);
      setNote("");
    },
  });

  if (!me.data) return null;

  const lead = leadQ.data;
  const isAdmin = me.data.role === "admin";

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to pipeline
        </Link>

        {leadQ.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : leadQ.error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
            {(leadQ.error as Error).message}
          </div>
        ) : lead ? (
          <>
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-accent">Lead</div>
                <h1 className="font-serif text-4xl mt-1">{lead.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {lead.email}{lead.company ? ` · ${lead.company}` : ""}
                </p>
              </div>
              {isAdmin && (
                <div className="min-w-[220px]">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assignee</Label>
                  <Select
                    value={lead.assigneeId ?? "unassigned"}
                    onValueChange={(v) => assignMut.mutate(v === "unassigned" ? null : v)}
                  >
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(usersQ.data ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </header>

            {/* pipeline rail interactive */}
            <div className="rounded-xl border bg-card p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
                Stage
              </div>
              <PipelineRail
                status={lead.status}
                interactive
                onChange={(next) => statusMut.mutate(next)}
              />
              {statusError && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {statusError}
                </div>
              )}
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
              {/* Info + Notes */}
              <div className="space-y-6">
                <section className="rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-serif text-xl">Details</h2>
                    {flash && <span className="text-xs text-accent-foreground/70">{flash}</span>}
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {(["name", "email", "phone", "company"] as const).map((k) => (
                      <div key={k} className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground capitalize">
                          {k}
                        </Label>
                        <Input
                          value={fields[k]}
                          onChange={(e) => { setFields((f) => ({ ...f, [k]: e.target.value })); setDirty(true); }}
                        />
                      </div>
                    ))}
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Message</Label>
                      <Textarea
                        rows={4}
                        value={fields.message}
                        onChange={(e) => { setFields((f) => ({ ...f, message: e.target.value })); setDirty(true); }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={() => saveMut.mutate(fields)}
                      disabled={!dirty || saveMut.isPending}
                      className="bg-navy text-navy-foreground hover:bg-navy/90"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saveMut.isPending ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                  {saveMut.error && (
                    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {(saveMut.error as Error).message}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border bg-card p-6">
                  <h2 className="font-serif text-xl">Notes</h2>
                  <form
                    className="mt-4 space-y-2"
                    onSubmit={(e) => { e.preventDefault(); if (note.trim()) noteMut.mutate(note.trim()); }}
                  >
                    <Textarea
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add a note for the team…"
                    />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={!note.trim() || noteMut.isPending} variant="outline">
                        <MessageSquarePlus className="h-4 w-4 mr-2" />
                        Add note
                      </Button>
                    </div>
                  </form>
                  <ul className="mt-6 space-y-4">
                    {[...lead.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((n) => (
                      <li key={n.id} className="rounded-lg border bg-background p-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{n.author?.name ?? "Unknown"}</span>
                          <span>{formatRelative(n.createdAt)}</span>
                        </div>
                        <p className="mt-2 text-sm whitespace-pre-wrap">{n.body}</p>
                      </li>
                    ))}
                    {lead.notes.length === 0 && (
                      <li className="text-sm text-muted-foreground">No notes yet.</li>
                    )}
                  </ul>
                </section>
              </div>

              {/* Activity trail */}
              <section className="rounded-xl border bg-card p-6 h-fit">
                <h2 className="font-serif text-xl">Activity</h2>
                <ol className="mt-6 relative border-l border-border/70 pl-6 space-y-6">
                  {[...lead.activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[27px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-accent ring-4 ring-background">
                        <CircleDot className="h-2.5 w-2.5 text-accent-foreground" />
                      </span>
                      <div className="text-sm">{describeActivity(a)}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatRelative(a.createdAt)}
                        {a.actor && (<><span>·</span><UserIcon className="h-3 w-3" />{a.actor.name}</>)}
                      </div>
                    </li>
                  ))}
                  {lead.activity.length === 0 && (
                    <li className="text-sm text-muted-foreground">No activity yet.</li>
                  )}
                </ol>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function describeActivity(a: LeadActivity): string {
  const m = a.metadata ?? {};
  switch (a.type) {
    case "LEAD_CREATED":
      return "Lead created";
    case "ASSIGNED":
      return m.assigneeName
        ? `Assigned to ${m.assigneeName}`
        : m.assigneeId
          ? `Assigned to ${m.assigneeId}`
          : "Assignment updated";
    case "STATUS_CHANGED":
      return `Stage moved${m.from ? ` from ${m.from}` : ""}${m.to ? ` to ${m.to}` : ""}`;
    case "NOTE_ADDED":
      return "Note added";
    case "FIELDS_UPDATED": {
      const fields = Array.isArray(m.fields) ? m.fields.join(", ") : Object.keys(m).join(", ");
      return fields ? `Updated ${fields}` : "Fields updated";
    }
    default:
      return "Activity";
  }
}

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.round((now - d) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// silence unused import in some builds
void cn;
