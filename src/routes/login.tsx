import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { GaugeCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — LeadFlow" },
      { name: "description", content: "Sign in to your LeadFlow workspace." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Sign in — LeadFlow" },
      { property: "og:description", content: "Sign in to your LeadFlow workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const me = useMe();
  const qc = useQueryClient();

  useEffect(() => {
    if (me.data) navigate({ to: "/dashboard", replace: true });
  }, [me.data, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", body: { email, password } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid email or password");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm"
        >
          <div className="flex items-center gap-2 justify-center mb-8">
            <GaugeCircle className="h-7 w-7 text-accent" />
            <span className="font-serif text-2xl tracking-tight">LeadFlow</span>
          </div>
          <div className="rounded-xl border bg-card p-8 shadow-sm">
            <h1 className="font-serif text-2xl">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to manage your pipeline.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Password</Label>
                <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full bg-navy text-navy-foreground hover:bg-navy/90 h-11">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}
