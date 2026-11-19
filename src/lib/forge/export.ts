import type { AuditEntry, CaseStatus, Detection } from "./types";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function auditCsv(audit: AuditEntry[]): string {
  return toCsv(["time_utc", "actor", "role", "target", "action", "detail"], [...audit].sort((a, b) => a.ts - b.ts).map((a) => [new Date(a.ts).toISOString(), a.actor ?? "", a.role, a.target, a.action, a.detail]));
}

export function casesCsv(cases: Detection[], statusOf: (ref: string) => CaseStatus): string {
  return toCsv(
    ["case_ref", "pattern", "pair", "venue", "status", "confidence", "window_start_utc", "window_end_utc", "source", "detector_version"],
    cases.map((d) => [d.caseRef, d.pattern, d.pair, d.venue.name, statusOf(d.caseRef), d.confidence, new Date(d.window.start).toISOString(), new Date(d.window.end).toISOString(), d.venue.source, d.detectorVersion]),
  );
}

export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
