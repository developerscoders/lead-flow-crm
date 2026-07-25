import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import { LayoutDashboard, Users, LogOut, GaugeCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useLogout, useMe } from "@/lib/auth";
import { Footer } from "./Footer";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const user = me.data;
  const logout = useLogout();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav = [
    { to: "/dashboard", label: "Leads", icon: LayoutDashboard, show: true },
    { to: "/admin/users", label: "Team", icon: Users, show: user?.role === "admin" },
  ].filter((n) => n.show);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-5 py-6 border-b border-sidebar-border/60">
          <Link to="/dashboard" className="flex items-center gap-2">
            <GaugeCircle className="h-6 w-6 text-accent" />
            <span className="font-serif text-xl tracking-tight">LeadFlow</span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r bg-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border/60 px-4 py-4">
          {user && (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{user.name}</div>
                <div className="truncate text-[11px] uppercase tracking-wider text-accent">
                  {user.role}
                </div>
              </div>
              <button
                onClick={logout}
                aria-label="Sign out"
                className="rounded-md p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar text-sidebar-foreground">
          <Link to="/dashboard" className="flex items-center gap-2">
            <GaugeCircle className="h-5 w-5 text-accent" />
            <span className="font-serif text-lg">LeadFlow</span>
          </Link>
          {user && (
            <button onClick={logout} className="text-xs uppercase tracking-wider">
              Sign out
            </button>
          )}
        </header>

        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 min-w-0"
        >
          {children}
        </motion.main>
        <Footer />
      </div>
    </div>
  );
}
