import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auditCsv, download } from "@/lib/forge/export";
import { fmtTs, ROLE_LABEL } from "@/lib/forge/format";
import { useForge } from "@/lib/forge/store";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — Probata Forensics" },
      { name: "description", content: "Chronological record of case decisions, narrative edits, exports and settings changes." },
      { property: "og:title", content: "Audit log — Probata Forensics" },
      { property: "og:description", content: "Chronological record of case decisions, narrative edits, exports and settings changes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { audit, mode, log } = useForge();
  const stamp = new Date().toISOString().slice(0, 10);
  const exportAs = (kind: "csv" | "json") => {
    if (kind === "csv") download(`probata-audit-${stamp}.csv`, auditCsv(audit), "text/csv");
    else download(`probata-audit-${stamp}.json`, JSON.stringify(audit.map((a) => ({ ...a, ts: new Date(a.ts).toISOString() })), null, 2), "application/json");
    log(`Audit log exported (${kind.toUpperCase()})`, "audit", `${audit.length} entries`);
  };
  const [q, setQ] = useState("");
  const rows = [...audit].sort((a, b) => b.ts - a.ts).filter((a) => !q || `${a.target} ${a.action} ${a.detail}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4 p-5 lg:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">Every status change, narrative edit, export and settings change. {mode === "team" ? "Saved to Lovable Cloud — entries are append-only and stamped by the database with who, when and role." : "Demo mode: entries stay in this browser. Sign in to keep a shared, tamper-resistant log."}</p>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by case or action" className="ml-auto w-64" aria-label="Filter audit log" />
        <Button variant="outline" size="sm" onClick={() => exportAs("csv")}><Download className="h-3.5 w-3.5" />CSV</Button>
        <Button variant="outline" size="sm" onClick={() => exportAs("json")}><Download className="h-3.5 w-3.5" />JSON</Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left">{["Time (UTC)", "Who", "Role", "Target", "Action", "Detail"].map((h) => <th key={h} className="label-caps px-4 py-2.5 font-normal">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">{fmtTs(a.ts)}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{a.actor ?? "Demo user"}</td>
                <td className="px-4 py-2 text-xs">{ROLE_LABEL[a.role]}</td>
                <td className="px-4 py-2 font-mono text-xs">{(a.target.startsWith("EF-") || a.target.startsWith("PF-LIVE")) ? <Link to="/cases/$caseId" params={{ caseId: a.target }} className="text-primary hover:underline">{a.target}</Link> : a.target}</td>
                <td className="px-4 py-2">{a.action}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{a.detail}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No entries.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
