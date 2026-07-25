import { createFileRoute, Link } from "@tanstack/react-router";
import { useMe } from "@/lib/auth";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, ArrowRight, GaugeCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Get in touch — LeadFlow" },
      {
        name: "description",
        content: "Share a few details and our team will follow up shortly.",
      },
      { property: "og:title", content: "Get in touch — LeadFlow" },
      {
        property: "og:description",
        content: "Share a few details and our team will follow up shortly.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const me = useMe();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
    website: "", // honeypot
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      await api("/api/public/leads", { method: "POST", body: form });
      setStatus("success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many submissions — please try again in a minute.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="w-full border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 lg:hidden">
          <GaugeCircle className="h-6 w-6 text-accent" />
          <span className="font-serif text-xl tracking-tight">LeadFlow</span>
        </div>
        <div className="hidden lg:block" />
        {me.data ? (
          <Link
            to="/dashboard"
            className="text-sm font-medium hover:text-accent transition-colors ml-auto flex items-center gap-1.5"
          >
            Go to Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            to="/login"
            className="text-sm font-medium hover:text-accent transition-colors ml-auto flex items-center gap-1.5"
          >
            Sign In <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </header>
      <div className="flex-1 grid lg:grid-cols-2">
        {/* Left rail — brand */}
        <div className="relative hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-12 overflow-hidden">
          <div className="flex items-center gap-2">
            <GaugeCircle className="h-7 w-7 text-accent" />
            <span className="font-serif text-2xl tracking-tight">LeadFlow</span>
          </div>
          <div className="relative z-10 max-w-md">
            <h1 className="font-serif text-5xl leading-[1.05] tracking-tight">
              Every lead,
              <br />
              <span className="text-accent italic">tracked with care.</span>
            </h1>
            <p className="mt-6 text-sidebar-foreground/70 leading-relaxed">
              Tell us a little about what you're working on. A member of our team will
              reach out within one business day.
            </p>

            <ol className="mt-10 space-y-4 text-sm">
              {[
                "We review your details within the day.",
                "A specialist replies with next steps.",
                "You get a proposal built around your goals.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent/60 text-[11px] font-medium text-accent">
                    {i + 1}
                  </span>
                  <span className="text-sidebar-foreground/80">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-sidebar-foreground/50">
            A Digital Heroes tool
          </div>

          <div
            aria-hidden
            className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
          />
        </div>

        {/* Right — form */}
        <div className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <AnimatePresence mode="wait">
              {status === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-12"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h2 className="mt-6 font-serif text-3xl">Thanks — we've got it.</h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Your message is with our team. Expect a reply within one business day
                    at <span className="text-foreground">{form.email}</span>.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onSubmit={onSubmit}
                  className="space-y-5"
                >
                  <div className="lg:hidden flex items-center gap-2 mb-4">
                    <GaugeCircle className="h-6 w-6 text-accent" />
                    <span className="font-serif text-xl">LeadFlow</span>
                  </div>
                  <div>
                    <h2 className="font-serif text-3xl leading-tight">Start a conversation</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Only name and email are required.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <Field label="Name" required>
                      <Input required value={form.name} onChange={update("name")} placeholder="Jane Rivera" />
                    </Field>
                    <Field label="Email" required>
                      <Input required type="email" value={form.email} onChange={update("email")} placeholder="jane@company.com" />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Phone">
                        <Input value={form.phone} onChange={update("phone")} placeholder="+1 555 0100" />
                      </Field>
                      <Field label="Company">
                        <Input value={form.company} onChange={update("company")} placeholder="Acme Co." />
                      </Field>
                    </div>
                    <Field label="Message">
                      <Textarea
                        rows={4}
                        value={form.message}
                        onChange={update("message")}
                        placeholder="A few lines about what you need…"
                      />
                    </Field>

                    {/* honeypot */}
                    <div className="sr-only-honeypot" aria-hidden="true">
                      <label>
                        Website
                        <input
                          tabIndex={-1}
                          autoComplete="off"
                          name="website"
                          value={form.website}
                          onChange={update("website")}
                        />
                      </label>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={status === "submitting"}
                    className="w-full bg-navy text-navy-foreground hover:bg-navy/90 h-11"
                  >
                    {status === "submitting" ? "Sending…" : (
                      <>Send message <ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}
