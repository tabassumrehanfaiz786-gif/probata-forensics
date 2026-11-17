// Regulatory filing drafts and admissibility checks built from an evidence package.
// Pure functions; citations are research references and must be verified before filing.
import type { EvidencePackage } from "./evidence";

export interface FilingSection { label: string; value: string }
export interface Filing { id: string; title: string; authority: string; basis: string; sections: FilingSection[] }

export function buildStor(p: EvidencePackage): Filing {
  const es = p.executiveSummary;
  return {
    id: `STOR-${p.caseRef}`,
    title: "Suspicious Transaction and Order Report (STOR) — draft",
    authority: "Financial Conduct Authority (UK)",
    basis: "UK MAR Art. 16(1)–(2); Commission Delegated Regulation (EU) 2016/957 as retained (STOR template)",
    sections: [
      { label: "1. Reporting entity", value: "[Firm name, FRN, MLRO contact] — complete before submission" },
      { label: "2. Instrument / crypto-asset", value: `${es.pair} on ${es.venue}` },
      { label: "3. Date & time of activity (UTC)", value: `${es.window.start} → ${es.window.end} (${es.window.duration})` },
      { label: "4. Type of suspected abuse", value: `${es.pattern} — market manipulation (UK MAR Art. 12 / Art. 15)` },
      { label: "5. Description of activity", value: es.summary },
      { label: "6. Reasons for suspicion", value: p.technicalAppendix.metrics.slice(0, 6).map((m) => `${m.label}: ${m.value}`).join("; ") },
      { label: "7. Persons / accounts involved", value: p.technicalAppendix.wallets.slice(0, 8).join(", ") || "Unknown — public data has no account identity" },
      { label: "8. Supporting evidence", value: `Package ${p.packageId}, SHA-256 ${p.auditTrail.packageHash}` },
      { label: "9. Confidence & limitations", value: `${es.confidence}/100. ${es.keyLimitations.join(" ")}` },
    ],
  };
}

export function buildMica(p: EvidencePackage): Filing {
  const es = p.executiveSummary;
  return {
    id: `MICA92-${p.caseRef}`,
    title: "MiCA Art. 92 suspicious order/transaction notification — draft",
    authority: "Home Member State National Competent Authority (EU)",
    basis: "Regulation (EU) 2023/1114 (MiCA) Art. 92(1); prohibition in Art. 91",
    sections: [
      { label: "1. Notifying CASP / person", value: "[CASP name, LEI, authorising NCA] — complete before submission" },
      { label: "2. Crypto-asset & trading platform", value: `${es.pair} · ${es.venue}` },
      { label: "3. Period", value: `${es.window.start} → ${es.window.end}` },
      { label: "4. Suspected conduct (Art. 91)", value: es.pattern },
      { label: "5. Provisions potentially engaged", value: es.engagedProvisions.map((x) => `${x.regime} ${x.citation} (${x.strength})`).join("; ") || "None mapped" },
      { label: "6. Description & indicators", value: es.summary },
      { label: "7. Evidence reference", value: `${p.packageId} · dataset ${p.auditTrail.datasetHash.slice(0, 24)}…` },
    ],
  };
}

export interface CheckItem { id: string; label: string; law: string; pass: boolean; note: string }

export function admissibilityChecklist(p: EvidencePackage): CheckItem[] {
  const a = p.auditTrail;
  return [
    { id: "hearsay", label: "Hearsay notice can be served", law: "Civil Evidence Act 1995 s.1–2; CPR 33.2", pass: true, note: "Computer records admissible as hearsay in civil proceedings; notice required." },
    { id: "document", label: "Copy of document authenticated", law: "Civil Evidence Act 1995 s.8", pass: a.packageHash.length === 64, note: "SHA-256 package hash allows a copy to be proved equivalent to the original." },
    { id: "records", label: "Business record certificate available", law: "Civil Evidence Act 1995 s.9", pass: a.dataSources.length > 0, note: "Venue/source of every record listed in the audit trail." },
    { id: "integrity", label: "Dataset integrity fixed", law: "Common-law presumption of reliability (post-YJCEA 1999 s.60 repeal of PACE s.69)", pass: a.datasetHash.length === 64, note: "Reproducible dataset hash; rebuttable if the system is shown to be unreliable." },
    { id: "custody", label: "Chain of custody logged", law: "Weight of evidence (CEA 1995 s.4)", pass: a.events.length > 0, note: `${a.events.length} audit events recorded.` },
    { id: "review", label: "Human review recorded", law: "FCA SUP 15 / MAR Art. 16 systems & controls", pass: p.classification === "FINAL", note: p.classification === "FINAL" ? "Reviewed package." : "Still DRAFT — needs compliance sign-off." },
    { id: "expert", label: "Method explainable for expert report", law: "CPR Part 35", pass: p.technicalAppendix.scoring.factors.length > 0, note: "Scoring factors itemised." },
  ];
}

export interface Precedent { name: string; cite: string; relevance: string }
export const PRECEDENTS: Precedent[] = [
  { name: "United States v. Eisenberg (Mango Markets)", cite: "S.D.N.Y. 2023–2025", relevance: "Oracle/price manipulation on a DeFi venue; conviction later vacated — shows difficulty proving manipulation on decentralised markets." },
  { name: "AA v Persons Unknown", cite: "[2019] EWHC 3556 (Comm)", relevance: "Cryptoassets capable of being property; supports freezing and tracing of manipulated proceeds." },
  { name: "Tulip Trading v Van Der Laan", cite: "[2023] EWCA Civ 83", relevance: "Arguable duties of developers in decentralised networks." },
  { name: "FCA v Da Vinci Invest Ltd", cite: "[2015] EWHC 2401 (Ch)", relevance: "Layering/spoofing as market abuse under FSMA s.118; algorithmic evidence of order patterns." },
];

export function filingToMarkdown(f: Filing): string {
  return [`# ${f.title}`, `Authority: ${f.authority}`, `Legal basis: ${f.basis}`, "", ...f.sections.map((s) => `**${s.label}**\n${s.value}\n`), "_Draft generated by Probata Forensics. Verify all citations before submission._"].join("\n");
}
