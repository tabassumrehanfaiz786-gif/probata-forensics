import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Network, FolderSearch, LayoutDashboard, ScrollText, Settings2, ShieldCheck, Scale } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtTs, ROLE_LABEL } from "@/lib/forge/format";
import { useForge } from "@/lib/forge/store";
import type { Role } from "@/lib/forge/types";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/cases", label: "Case library", icon: FolderSearch, exact: false },
  { to: "/graph", label: "Intelligence graph", icon: Network, exact: false },
  { to: "/audit", label: "Audit log", icon: ScrollText, exact: false },
  { to: "/settings", label: "Settings", icon: Settings2, exact: false },
] as const;

function UtcClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-xs text-muted-foreground tabular-nums">{now ? fmtTs(now) : "—"}</span>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { role, setRole, cases, statusOf } = useForge();
  if (pathname.startsWith("/report/")) return <>{children}</>;
  const open = cases.filter((c) => statusOf(c.caseRef) === "new").length;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-5">
          <div className="grid h-8 w-8 place-items-center rounded-md border border-primary/40 bg-primary/10">
            <Scale className="h-4 w-4 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">Probata Forensics</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Things Proved · MARC · MiCA</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <n.icon className={cn("h-4 w-4", active ? "text-primary" : "")} />
                <span className="flex-1">{n.label}</span>
                {n.to === "/cases" && open > 0 && <span className="rounded bg-alert/15 px-1.5 font-mono text-[10px] text-alert">{open}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="label-caps mb-2">Signed in as (demo)</div>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="h-8 bg-background/40 text-xs" aria-label="Switch role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <SelectItem key={r} value={r} className="text-xs">{ROLE_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Role controls who can escalate, dismiss, export final packages and change settings.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-4 border-b border-border bg-background/85 px-5 backdrop-blur">
          <div className="flex items-center gap-2 md:hidden">
            <Scale className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Probata Forensics</span>
          </div>
          <nav className="flex gap-3 text-xs md:hidden">
            {NAV.map((n) => <Link key={n.to} to={n.to} className="text-muted-foreground hover:text-foreground">{n.label}</Link>)}
          </nav>
          <div className="hidden items-center gap-2 rounded border border-alert/30 bg-alert/10 px-2 py-0.5 md:flex">
            <Activity className="h-3 w-3 text-alert" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-alert">Sample replay dataset</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <UtcClock />
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{ROLE_LABEL[role]}</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
