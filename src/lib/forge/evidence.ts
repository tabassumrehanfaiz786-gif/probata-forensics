/**
 * Evidence package: a self-describing, versioned JSON document plus Markdown and print (PDF)
 * renderings. The package hash covers every field except the hash itself, so any later edit to
 * an exported package is detectable.
 */
import { fmtTs, PATTERN_LABEL, ROLE_LABEL, STATUS_LABEL, pct, fmtDuration } from "./format";
import { mapLegal, STRENGTH_LABEL, type LegalMapping } from "./legal";
import type { AuditEntry, CaseStatus, Detection, EvidenceRecord, Metric, Role, ScoreFactor, Scenario, TimelineEvent } from "./types";

export const EVIDENCE_SCHEMA_VERSION = "ef.evidence/1.0";

export interface EvidencePackage {
  schemaVersion: string;
  packageId: string;
  caseRef: string;
  classification: "DRAFT" | "FINAL";
  generatedAt: string;
  generatedBy: { role: Role; roleLabel: string };
  status: CaseStatus;
  executiveSummary: {
    pattern: string;
    confidence: number;
    venue: string;
    pair: string;
    window: { start: string; end: string; duration: string };
    summary: string;
    engagedProvisions: { regime: string; citation: string; strength: string }[];
    keyLimitations: string[];
  };
  timeline: { ts: string; kind: TimelineEvent["kind"]; label: string; detail: string; evidenceRef?: string | undefined }[];
  legal: { marc: LegalMapping; mica: LegalMapping; narrativeEditedByAnalyst: { marc: boolean; mica: boolean } };
  technicalAppendix: {
    metrics: Metric[];
    scoring: { factors: ScoreFactor[]; total: number; cap: number; threshold: number };
    clusters: Detection["clusters"];
    wallets: string[];
    records: (Omit<EvidenceRecord, "ts"> & { ts: string })[];
    limitations: string[];
  };
  auditTrail: {
    dataSources: { venue: string; source: string; mode: string }[];
    detectorVersion: string;
    legalTemplates: { marc: string; mica: string };
    datasetHash: string;
    datasetRecordCount: number;
    events: { ts: string; role: string; action: string; detail: string }[];
    packageHash: string;
  };
  disclaimer: string;
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface BuildOptions {
  role: Role;
  status: CaseStatus;
  generatedAt: Date;
  threshold: number;
  cap: number;
  narratives: { marc?: string | undefined; mica?: string | undefined };
  audit: AuditEntry[];
}

export async function buildEvidencePackage(d: Detection, scenario: Scenario, o: BuildOptions): Promise<EvidencePackage> {
  const marc = mapLegal(d, "MARC");
  const mica = mapLegal(d, "MiCA");
  if (o.narratives.marc) marc.narrative = o.narratives.marc;
  if (o.narratives.mica) mica.narrative = o.narratives.mica;
  const dataset = JSON.stringify({ trades: scenario.trades, orders: scenario.orders, funding: scenario.funding, social: scenario.social });
  const datasetHash = await sha256(dataset);
  const final = o.role !== "analyst";
  const pkg: EvidencePackage = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    packageId: `${d.caseRef}-${o.generatedAt.toISOString().replace(/[-:]/g, "").slice(0, 15)}`,
    caseRef: d.caseRef,
    classification: final ? "FINAL" : "DRAFT",
    generatedAt: o.generatedAt.toISOString(),
    generatedBy: { role: o.role, roleLabel: ROLE_LABEL[o.role] },
    status: o.status,
    executiveSummary: {
      pattern: PATTERN_LABEL[d.pattern],
      confidence: d.confidence,
      venue: `${d.venue.name}${d.venue.chain ? ` (${d.venue.chain})` : ""}`,
      pair: d.pair,
      window: { start: fmtTs(d.window.start), end: fmtTs(d.window.end), duration: fmtDuration(d.window.end - d.window.start) },
      summary: d.summary,
      engagedProvisions: [...marc.engaged.map((e) => ({ regime: "UK MARC", citation: e.element.citation, strength: STRENGTH_LABEL[e.strength] })), ...mica.engaged.map((e) => ({ regime: "MiCA", citation: e.element.citation, strength: STRENGTH_LABEL[e.strength] }))],
      keyLimitations: d.limitations.slice(0, 3),
    },
    timeline: d.timeline.map((t) => ({ ts: fmtTs(t.ts), kind: t.kind, label: t.label, detail: t.detail, evidenceRef: t.ref })),
    legal: { marc, mica, narrativeEditedByAnalyst: { marc: !!o.narratives.marc, mica: !!o.narratives.mica } },
    technicalAppendix: {
      metrics: d.metrics,
      scoring: { factors: d.factors, total: d.confidence, cap: o.cap, threshold: o.threshold },
      clusters: d.clusters,
      wallets: d.wallets,
      records: d.evidence.map((e) => ({ ...e, ts: fmtTs(e.ts) })),
      limitations: d.limitations,
    },
    auditTrail: {
      dataSources: [{ venue: d.venue.name, source: d.venue.source, mode: "Sample replay dataset (deterministic)" }],
      detectorVersion: d.detectorVersion,
      legalTemplates: { marc: marc.templateVersion, mica: mica.templateVersion },
      datasetHash,
      datasetRecordCount: scenario.trades.length + scenario.orders.length + scenario.funding.length + scenario.social.length,
      events: o.audit.filter((a) => a.target === d.caseRef).map((a) => ({ ts: fmtTs(a.ts), role: ROLE_LABEL[a.role], action: a.action, detail: a.detail })),
      packageHash: "",
    },
    disclaimer: "This package presents statistical indicators and a structured legal analysis for investigative triage. It does not establish that any person engaged in market abuse, and is not legal advice. Counter-arguments and limitations are integral to the analysis and must be read with it.",
  };
  pkg.auditTrail.packageHash = await sha256(JSON.stringify({ ...pkg, auditTrail: { ...pkg.auditTrail, packageHash: "" } }));
  return pkg;
}

const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");

function legalMd(m: LegalMapping, title: string, edited: boolean): string {
  return `### ${title}

*Template ${m.templateVersion} — ${m.instrument}*

**Potentially engaged elements**

${m.engaged.length ? m.engaged.map((e) => `- **${e.element.citation} — ${e.element.title}** (${STRENGTH_LABEL[e.strength]})\n  ${e.rationale}`).join("\n") : "- None identified on the available facts."}

**Factual narrative**${edited ? " *(edited by analyst)*" : ""}

${m.narrative}

**Indicators relevant to intent or knowledge**

${list(m.intentIndicators)}

**Counter-arguments — why this may not constitute market abuse**

${list(m.counterArguments)}

**Suggested next steps**

${list(m.nextSteps)}

> ${m.caveat}
`;
}

export function toMarkdown(p: EvidencePackage): string {
  const es = p.executiveSummary;
  const t = p.technicalAppendix;
  return `# Evidence Package ${p.caseRef}

**${p.classification}** · Package \`${p.packageId}\` · Schema ${p.schemaVersion}
Generated ${p.generatedAt} by ${p.generatedBy.roleLabel} · Case status: ${STATUS_LABEL[p.status]}

## 1. Executive summary

| | |
|---|---|
| Pattern | ${es.pattern} |
| Confidence | ${es.confidence}/100 |
| Venue | ${es.venue} |
| Pair | ${es.pair} |
| Window | ${es.window.start} → ${es.window.end} (${es.window.duration}) |

${es.summary}

**Provisions potentially engaged:** ${es.engagedProvisions.map((x) => `${x.regime} ${x.citation} (${x.strength.toLowerCase()})`).join("; ") || "none"}

**Key limitations**

${list(es.keyLimitations)}

## 2. Factual timeline

| Time (UTC) | Event | Detail | Evidence ref |
|---|---|---|---|
${p.timeline.map((e) => `| ${e.ts} | ${e.label} | ${e.detail.replace(/\|/g, "/")} | ${e.evidenceRef ? `\`${e.evidenceRef.slice(0, 18)}${e.evidenceRef.length > 18 ? "…" : ""}\`` : "—"} |`).join("\n")}

## 3. Legal characterisation

${legalMd(p.legal.marc, "3A. UK Market Abuse Regime for Cryptoassets (MARC)", p.legal.narrativeEditedByAnalyst.marc)}
${legalMd(p.legal.mica, "3B. MiCA Article 91 — Prohibition of market manipulation", p.legal.narrativeEditedByAnalyst.mica)}
## 4. Technical evidence appendix

**Metrics**

${t.metrics.map((m) => `- ${m.label}: **${m.value}**${m.hint ? ` (${m.hint})` : ""}`).join("\n")}

**Confidence scoring** — total ${t.scoring.total}/100 (cap ${t.scoring.cap}, alert threshold ${t.scoring.threshold})

| Factor | Observed | Score | Max |
|---|---|---|---|
${t.scoring.factors.map((f) => `| ${f.label} | ${f.observed} | ${f.score} | ${f.weight} |`).join("\n")}

**Clusters**

${t.clusters.map((c) => `- ${c.id}: ${c.basis} — ${c.wallets.join(", ")}`).join("\n")}

**Evidence records (${t.records.length})**

| Time (UTC) | Ref | Type | From | To | Price | Size | Note |
|---|---|---|---|---|---|---|---|
${t.records.map((r) => `| ${r.ts} | \`${r.ref.slice(0, 16)}\` | ${r.type} | ${r.from.slice(0, 14)} | ${r.to.slice(0, 14)} | ${r.price?.toPrecision(6) ?? ""} | ${r.size?.toFixed(2) ?? ""} | ${r.note} |`).join("\n")}

**Limitations**

${list(t.limitations)}

## 5. Audit trail

- Data sources: ${p.auditTrail.dataSources.map((s) => `${s.venue} — ${s.source} (${s.mode})`).join("; ")}
- Detector: ${p.auditTrail.detectorVersion}
- Legal templates: MARC ${p.auditTrail.legalTemplates.marc}; MiCA ${p.auditTrail.legalTemplates.mica}
- Dataset SHA-256: \`${p.auditTrail.datasetHash}\` (${p.auditTrail.datasetRecordCount} records)
- Package SHA-256: \`${p.auditTrail.packageHash}\`

${p.auditTrail.events.length ? `| Time (UTC) | Role | Action | Detail |\n|---|---|---|---|\n${p.auditTrail.events.map((e) => `| ${e.ts} | ${e.role} | ${e.action} | ${e.detail} |`).join("\n")}` : "_No case actions recorded._"}

---

*${p.disclaimer}*
`;
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { pct };
