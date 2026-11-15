import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Input } from "@/components/ui/input";
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
  const { audit } = useForge();
  const [q, setQ] = useState("");
  const rows = [...audit].sort((a, b) => b.ts - a.ts).filter((a) => !q || `${a.target} ${a.action} ${a.detail}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4 p-5 lg:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">Every status change, narrative edit, export and settings change. Entries are append-only.</p>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by case or action" className="ml-auto w-64" aria-label="Filter audit log" />
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left">{["Time (UTC)", "Role", "Target", "Action", "Detail"].map((h) => <th key={h} className="label-caps px-4 py-2.5 font-normal">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">{fmtTs(a.ts)}</td>
                <td className="px-4 py-2 text-xs">{ROLE_LABEL[a.role]}</td>
                <td className="px-4 py-2 font-mono text-xs">{a.target.startsWith("EF-") ? <Link to="/cases/$caseId" params={{ caseId: a.target }} className="text-primary hover:underline">{a.target}</Link> : a.target}</td>
                <td className="px-4 py-2">{a.action}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{a.detail}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No entries.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
