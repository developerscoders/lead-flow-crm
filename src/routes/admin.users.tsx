import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "motion/react";
import { UserPlus, ShieldAlert } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type Envelope, type User } from "@/lib/api";
import { useRequireAuth, useMe } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Team — LeadFlow" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Manage team members and roles." },
      { property: "og:title", content: "Team — LeadFlow" },
      { property: "og:description", content: "Manage team members and roles." },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  useRequireAuth();
  const me = useMe();
  const qc = useQueryClient();

  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api<Envelope<User[]>>("/api/users")).data,
    enabled: me.data?.role === "admin",
  });

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" as "admin" | "member" });
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: (body: typeof form) => api<Envelope<User>>("/api/users", { method: "POST", body }),
    onMutate: () => setError(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setForm({ name: "", email: "", password: "", role: "member" });
    },
    onError: (e) => {
      if (e instanceof ApiError) setError(e.message);
      else setError("Could not create user");
    },
  });

  if (!me.data) return null;

  if (me.data.role !== "admin") {
    return (
      <AppShell>
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h1 className="font-serif text-2xl mt-4">You don't have access</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This page is available to workspace admins only.
            </p>
            <Link to="/dashboard" className="mt-6 inline-block text-sm underline text-accent-foreground/80">
              Back to pipeline
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        <header>
          <div className="text-[11px] uppercase tracking-[0.2em] text-accent">Admin</div>
          <h1 className="font-serif text-4xl mt-1">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage who can sign in to LeadFlow.</p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          {/* Users table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="grid grid-cols-[1.4fr_1.6fr_100px] gap-4 px-6 py-3 border-b bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <div>Name</div>
              <div>Email</div>
              <div className="text-right">Role</div>
            </div>
            {usersQ.isLoading ? (
              <div className="divide-y">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[1.4fr_1.6fr_100px] gap-4 px-6 py-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-16 ml-auto" />
                  </div>
                ))}
              </div>
            ) : usersQ.error ? (
              <div className="p-6 text-sm text-destructive">{(usersQ.error as Error).message}</div>
            ) : (
              <ul className="divide-y">
                {(usersQ.data ?? []).map((u, i) => (
                  <motion.li
                    key={u.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className="grid grid-cols-[1.4fr_1.6fr_100px] gap-4 px-6 py-4 items-center"
                  >
                    <div className="font-medium">{u.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{u.email}</div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${u.role === "admin" ? "bg-accent/20 text-accent-foreground" : "bg-muted text-foreground"}`}>
                        {u.role}
                      </span>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>

          {/* New user */}
          <form
            onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }}
            className="rounded-xl border bg-card p-6 h-fit space-y-4"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-accent" />
              <h2 className="font-serif text-xl">Invite a teammate</h2>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Temporary password</Label>
              <Input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "member" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" disabled={createMut.isPending} className="w-full bg-navy text-navy-foreground hover:bg-navy/90">
              {createMut.isPending ? "Creating…" : "Create user"}
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
