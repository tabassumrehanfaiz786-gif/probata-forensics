import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Filter, ShieldAlert } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ConfidenceBadge, Panel, PatternTag, StatusBadge } from "@/components/forge/badges";
import { LiveFeed } from "@/components/forge/LiveFeed";
import { fmtDate, fmtHm, PATTERN_CODE, PATTERN_LABEL } from "@/lib/forge/format";
import { useForge } from "@/lib/forge/store";
import type { PatternType } from "@/lib/forge/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Probata Forensics" },
      { name: "description", content: "Live high-priority crypto market abuse alerts and risk overview across venues." },
      { property: "og:title", content: "Dashboard — Probata Forensics" },
      { property: "og:description", content: "Live high-priority crypto market abuse alerts and risk overview across venues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Stat({ label, value, tone, sub }: { label: string; value: number | string; tone: string; sub: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="label-caps">{label}</div>
      <div className={`mt-1 font-mono text-3xl font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Dashboard() {
  const { cases, suppressed, statusOf, settings } = useForge();
  const open = cases.filter((c) => ["new", "under_review"].includes(statusOf(c.caseRef))).sort((a, b) => b.confidence - a.confidence);
  const counts = {
    new: cases.filter((c) => statusOf(c.caseRef) === "new").length,
    review: cases.filter((c) => statusOf(c.caseRef) === "under_review").length,
    escalated: cases.filter((c) => statusOf(c.caseRef) === "escalated").length,
  };
  const byPattern = (["wash_trading", "spoofing", "coordinated_pump"] as PatternType[]).map((p) => {
    const xs = cases.filter((c) => c.pattern === p);
    return { pattern: PATTERN_CODE[p], cases: xs.length, avg: xs.length ? Math.round(xs.reduce((a, c) => a + c.confidence, 0) / xs.length) : 0 };
  });
  const venues = Object.values(
    cases.reduce<Record<string, { name: string; n: number; max: number }>>((acc, c) => {
      const k = `${c.venue.name}${c.venue.chain ? ` · ${c.venue.chain}` : ""}`;
      acc[k] = acc[k] ?? { name: k, n: 0, max: 0 };
      acc[k].n++;
      acc[k].max = Math.max(acc[k].max, c.confidence);
      return acc;
    }, {}),
  ).sort((a, b) => b.max - a.max);

  return (
    <div className="space-y-5 p-5 lg:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Surveillance overview</h1>
          <p className="text-sm text-muted-foreground">Replay window 1–13 Nov 2026 · alert threshold {settings.minConfidence} · {cases.length} cases above threshold</p>
        </div>
        <Link to="/cases" className="ml-auto inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Open case library <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="New alerts" value={counts.new} tone="text-alert" sub="Awaiting triage" />
        <Stat label="Under review" value={counts.review} tone="text-primary" sub="Assigned to an analyst" />
        <Stat label="Escalated" value={counts.escalated} tone="text-critical" sub="With compliance / MLRO" />
        <Stat label="Suppressed" value={suppressed.length} tone="text-muted-foreground" sub={`Candidates below ${settings.minConfidence} — precision gate`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Panel title="High-priority alerts" action={<span className="font-mono text-[10px] text-muted-foreground">sorted by confidence</span>} bodyClassName="p-0">
          {open.length === 0 && <p className="p-6 text-sm text-muted-foreground">No open alerts.</p>}
          <ul className="divide-y divide-border">
            {open.map((c) => (
              <li key={c.id}>
                <Link to="/cases/$caseId" params={{ caseId: c.caseRef }} className="group flex gap-4 px-4 py-3.5 transition-colors hover:bg-accent/40">
                  <ConfidenceBadge value={c.confidence} className="mt-0.5 h-7 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-sm font-medium">{c.caseRef}</span>
                      <PatternTag pattern={c.pattern} full />
                      <span className="text-sm text-foreground/80">{c.pair}</span>
                      <span className="text-xs text-muted-foreground">{c.venue.name}{c.venue.chain ? ` · ${c.venue.chain}` : ""}</span>
                      <span className="ml-auto"><StatusBadge status={statusOf(c.caseRef)} /></span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{c.summary}</p>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">{fmtDate(c.window.start)} {fmtHm(c.window.start)}–{fmtHm(c.window.end)} UTC · {c.detectorVersion} · {c.assignee}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-5">
          <Panel title="Live ingestion">
            <LiveFeed />
          </Panel>
          <Panel title="Cases by pattern">
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byPattern} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="pattern" width={52} stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "var(--accent)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: number, n: string) => [v, n === "cases" ? "Cases" : "Avg confidence"]} />
                  <Bar dataKey="cases" fill="var(--alert)" radius={[0, 3, 3, 0]} barSize={14} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center font-mono text-[11px] text-muted-foreground">
              {byPattern.map((p) => <div key={p.pattern}>{p.pattern} avg <span className="text-foreground">{p.avg || "—"}</span></div>)}
            </div>
          </Panel>
          <Panel title="Venues with alerts" bodyClassName="p-0">
            <ul className="divide-y divide-border text-sm">
              {venues.map((v) => (
                <li key={v.name} className="flex items-center gap-3 px-4 py-2">
                  <span className="flex-1">{v.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{v.n} case{v.n > 1 ? "s" : ""}</span>
                  <ConfidenceBadge value={v.max} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {suppressed.length > 0 && (
        <Panel title={<span className="flex items-center gap-2"><Filter className="h-3 w-3" /> Precision gate — suppressed candidates</span>}>
          <p className="mb-3 text-sm text-muted-foreground">These candidates were scored but fell below the alert threshold. They are kept for audit rather than discarded.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {suppressed.map((s) => (
              <Link key={s.id} to="/cases/$caseId" params={{ caseId: s.caseRef }} className="flex gap-3 rounded border border-border bg-panel p-3 hover:border-primary/40">
                <ConfidenceBadge value={s.confidence} />
                <div className="min-w-0 text-sm">
                  <div className="flex gap-2"><span className="font-mono">{s.caseRef}</span><PatternTag pattern={s.pattern} /><span className="text-muted-foreground">{s.pair} · {s.venue.name}</span></div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.summary}</p>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" /> Indicators only. Probata Forensics never concludes that a person committed market abuse; every case carries counter-arguments for review. Patterns covered: {Object.values(PATTERN_LABEL).join(", ")}.
      </p>
    </div>
  );
}
