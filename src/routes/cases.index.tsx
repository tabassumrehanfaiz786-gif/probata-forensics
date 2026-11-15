import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ConfidenceBadge, PatternTag, StatusBadge } from "@/components/forge/badges";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fmtDate, fmtDuration, fmtHm, PATTERN_LABEL, STATUS_LABEL } from "@/lib/forge/format";
import { useForge } from "@/lib/forge/store";
import type { CaseStatus, PatternType } from "@/lib/forge/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cases/")({
  head: () => ({
    meta: [
      { title: "Case library — Probata Forensics" },
      { name: "description", content: "Search and filter historical market manipulation cases by pattern, venue, status and confidence." },
      { property: "og:title", content: "Case library — Probata Forensics" },
      { property: "og:description", content: "Search and filter historical market manipulation cases by pattern, venue, status and confidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CaseLibrary,
});

function CaseLibrary() {
  const { detections, statusOf } = useForge();
  const [q, setQ] = useState("");
  const [pattern, setPattern] = useState<"all" | PatternType>("all");
  const [status, setStatus] = useState<"all" | CaseStatus>("all");
  const [showSuppressed, setShowSuppressed] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return detections
      .filter((d) => showSuppressed || !d.suppressed)
      .filter((d) => pattern === "all" || d.pattern === pattern)
      .filter((d) => status === "all" || statusOf(d.caseRef) === status)
      .filter((d) => !needle || [d.caseRef, d.pair, d.venue.name, d.venue.chain ?? "", d.assignee, ...d.wallets].some((x) => x.toLowerCase().includes(needle)))
      .sort((a, b) => b.window.start - a.window.start);
  }, [detections, q, pattern, status, showSuppressed, statusOf]);

  return (
    <div className="space-y-4 p-5 lg:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Case library</h1>
        <p className="text-sm text-muted-foreground">Search by case reference, pair, venue, assignee or wallet address.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="EF-2026-0147, VLTA, 0x56a2…" className="pl-8 font-mono text-sm" aria-label="Search cases" />
        </div>
        <Select value={pattern} onValueChange={(v) => setPattern(v as typeof pattern)}>
          <SelectTrigger className="w-48" aria-label="Filter by pattern"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All patterns</SelectItem>
            {(Object.keys(PATTERN_LABEL) as PatternType[]).map((p) => <SelectItem key={p} value={p}>{PATTERN_LABEL[p]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABEL) as CaseStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showSuppressed} onCheckedChange={setShowSuppressed} /> Show suppressed
        </label>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {["Conf.", "Case", "Pattern", "Pair / venue", "Window (UTC)", "Wallets", "Assignee", "Status"].map((h) => (
                <th key={h} className="label-caps px-3 py-2.5 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((d) => (
              <tr key={d.id} className={cn("transition-colors hover:bg-accent/40", d.suppressed && "opacity-60")}>
                <td className="px-3 py-2.5"><ConfidenceBadge value={d.confidence} /></td>
                <td className="px-3 py-2.5">
                  <Link to="/cases/$caseId" params={{ caseId: d.caseRef }} className="font-mono text-primary hover:underline">{d.caseRef}</Link>
                </td>
                <td className="px-3 py-2.5"><PatternTag pattern={d.pattern} full /></td>
                <td className="px-3 py-2.5">
                  <div>{d.pair}</div>
                  <div className="text-xs text-muted-foreground">{d.venue.name}{d.venue.chain ? ` · ${d.venue.chain}` : ""} <span className="font-mono">{d.venue.kind}</span></div>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">
                  <div>{fmtDate(d.window.start)} {fmtHm(d.window.start)}</div>
                  <div className="text-muted-foreground">{fmtDuration(d.window.end - d.window.start)}</div>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{d.wallets.length}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{d.assignee}</td>
                <td className="px-3 py-2.5">{d.suppressed ? <span className="text-xs text-muted-foreground">Suppressed</span> : <StatusBadge status={statusOf(d.caseRef)} />}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No cases match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
