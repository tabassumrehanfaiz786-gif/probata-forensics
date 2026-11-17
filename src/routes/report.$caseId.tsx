import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileJson, FileText, Printer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { downloadText, toMarkdown, type EvidencePackage } from "@/lib/forge/evidence";
import { STATUS_LABEL } from "@/lib/forge/format";
import { STRENGTH_LABEL, type LegalMapping } from "@/lib/forge/legal";
import { useForge } from "@/lib/forge/store";

export const Route = createFileRoute("/report/$caseId")({
  head: ({ params }) => ({
    meta: [
      { title: `Evidence package ${params.caseId} — Probata Forensics` },
      { name: "description", content: `Printable evidence package for case ${params.caseId} with MARC and MiCA legal characterisation and audit trail.` },
      { property: "og:title", content: `Evidence package ${params.caseId} — Probata Forensics` },
      { property: "og:description", content: `Printable evidence package for case ${params.caseId}.` },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Report,
});

function Report() {
  const { caseId } = Route.useParams();
  const { ready, buildPackage, log } = useForge();
  const [pkg, setPkg] = useState<EvidencePackage | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    buildPackage(caseId).then((p) => { if (!live) return; if (p) setPkg(p); else setMissing(true); });
    return () => { live = false; };
    // build once per visit; later state edits should not silently change an open package
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, caseId]);

  if (missing) return <div className="p-10 text-center">Case {caseId} not found.</div>;
  if (!pkg) return <div className="p-10 text-center font-mono text-sm text-muted-foreground">Assembling evidence package and computing hashes…</div>;

  const es = pkg.executiveSummary;
  const t = pkg.technicalAppendix;

  return (
    <div className="min-h-screen bg-muted/40 py-6 print:bg-paper print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[900px] flex-wrap items-center gap-2 px-4">
        <Link to="/cases/$caseId" params={{ caseId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to workspace</Link>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link to="/filings/$caseId" params={{ caseId }} className="inline-flex items-center rounded-md border border-input px-3 text-sm">Regulatory filings</Link>
          <Button variant="outline" size="sm" onClick={() => { downloadText(`${pkg.packageId}.md`, toMarkdown(pkg), "text/markdown"); log(`Exported Markdown (${pkg.classification})`, caseId, `sha256 ${pkg.auditTrail.packageHash.slice(0, 16)}…`); }}><FileText className="mr-1.5 h-4 w-4" /> Markdown</Button>
          <Button variant="outline" size="sm" onClick={() => { downloadText(`${pkg.packageId}.json`, JSON.stringify(pkg, null, 2), "application/json"); log(`Exported JSON (${pkg.classification})`, caseId, `sha256 ${pkg.auditTrail.packageHash.slice(0, 16)}…`); }}><FileJson className="mr-1.5 h-4 w-4" /> JSON</Button>
          <Button size="sm" onClick={() => { log(`Exported PDF (${pkg.classification})`, caseId, `sha256 ${pkg.auditTrail.packageHash.slice(0, 16)}…`); window.print(); }}><Printer className="mr-1.5 h-4 w-4" /> Save as PDF</Button>
        </div>
      </div>

      <article className="relative mx-auto max-w-[900px] bg-paper px-12 py-12 font-serif text-[13.5px] leading-relaxed text-paper-foreground shadow-xl print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {pkg.classification === "DRAFT" && (
          <div className="pointer-events-none absolute right-10 top-10 rotate-6 border-2 border-critical px-3 py-1 font-sans text-sm font-bold tracking-widest text-critical">DRAFT — NOT REVIEWED</div>
        )}
        <header className="border-b-2 border-paper-foreground pb-5">
          <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-paper-muted">Probata Forensics · Evidence package · {pkg.classification}</div>
          <h1 className="mt-2 font-sans text-3xl font-semibold tracking-tight">{pkg.caseRef}: {es.pattern}</h1>
          <p className="mt-1 font-sans text-sm text-paper-muted">{es.pair} · {es.venue} · {es.window.start} → {es.window.end}</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 font-sans text-[11px] text-paper-muted md:grid-cols-4">
            <div><dt>Package</dt><dd className="font-mono text-paper-foreground">{pkg.packageId}</dd></div>
            <div><dt>Generated</dt><dd className="font-mono text-paper-foreground">{pkg.generatedAt.replace("T", " ").slice(0, 19)}Z</dd></div>
            <div><dt>By / status</dt><dd className="text-paper-foreground">{pkg.generatedBy.roleLabel} · {STATUS_LABEL[pkg.status]}</dd></div>
            <div><dt>Schema</dt><dd className="font-mono text-paper-foreground">{pkg.schemaVersion}</dd></div>
          </dl>
        </header>

        <Section n="1" title="Executive summary">
          <div className="mb-3 flex items-baseline gap-4 font-sans">
            <span className="text-4xl font-semibold">{es.confidence}<span className="text-base text-paper-muted">/100</span></span>
            <span className="text-sm text-paper-muted">Confidence · window {es.window.duration}</span>
          </div>
          <p>{es.summary}</p>
          <p className="mt-3"><strong>Provisions potentially engaged:</strong> {es.engagedProvisions.map((p) => `${p.regime} ${p.citation} (${p.strength.toLowerCase()})`).join("; ") || "none identified"}.</p>
          <p className="mt-3 font-sans text-xs font-semibold uppercase tracking-wider text-paper-muted">Key limitations</p>
          <ul className="mt-1 list-disc pl-5">{es.keyLimitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </Section>

        <Section n="2" title="Factual timeline">
          <table className="w-full border-collapse font-sans text-[11.5px]">
            <thead><tr className="border-b border-paper-border text-left text-paper-muted"><th className="py-1.5 pr-3 font-medium">Time (UTC)</th><th className="py-1.5 pr-3 font-medium">Event</th><th className="py-1.5 font-medium">Detail &amp; evidence ref</th></tr></thead>
            <tbody>
              {pkg.timeline.map((e, i) => (
                <tr key={i} className="border-b border-paper-border/70 align-top">
                  <td className="whitespace-nowrap py-1.5 pr-3 font-mono">{e.ts}</td>
                  <td className="py-1.5 pr-3 font-medium">{e.label}</td>
                  <td className="py-1.5">{e.detail}{e.evidenceRef && <div className="break-all font-mono text-[10px] text-paper-accent">{e.evidenceRef}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section n="3A" title="Legal characterisation — UK MARC" breakBefore><LegalBlock m={pkg.legal.marc} edited={pkg.legal.narrativeEditedByAnalyst.marc} /></Section>
        <Section n="3B" title="Legal characterisation — MiCA Article 91"><LegalBlock m={pkg.legal.mica} edited={pkg.legal.narrativeEditedByAnalyst.mica} /></Section>

        <Section n="4" title="Technical evidence appendix" breakBefore>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-sans text-[12px] md:grid-cols-3">
            {t.metrics.map((m) => <div key={m.label}><span className="text-paper-muted">{m.label}:</span> <strong>{m.value}</strong></div>)}
          </div>
          <h4 className="mt-4 font-sans text-xs font-semibold uppercase tracking-wider text-paper-muted">Confidence scoring (cap {t.scoring.cap}, threshold {t.scoring.threshold})</h4>
          <table className="mt-1 w-full border-collapse font-sans text-[11.5px]">
            <tbody>
              {t.scoring.factors.map((f) => (
                <tr key={f.key} className="border-b border-paper-border/70 align-top">
                  <td className="py-1.5 pr-3 font-medium">{f.label}</td>
                  <td className="py-1.5 pr-3 font-mono">{f.observed}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{f.score.toFixed(1)}/{f.weight}</td>
                  <td className="py-1.5 text-paper-muted">{f.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 className="mt-4 font-sans text-xs font-semibold uppercase tracking-wider text-paper-muted">Clusters</h4>
          {t.clusters.map((c) => <p key={c.id} className="font-sans text-[11.5px]"><strong>{c.id}</strong> — {c.basis}: <span className="break-all font-mono text-[10.5px]">{c.wallets.join(", ")}</span></p>)}
          <h4 className="mt-4 font-sans text-xs font-semibold uppercase tracking-wider text-paper-muted">Evidence records ({t.records.length})</h4>
          <table className="mt-1 w-full border-collapse font-mono text-[10px]">
            <tbody>
              {t.records.map((r, i) => (
                <tr key={i} className="border-b border-paper-border/60">
                  <td className="py-1 pr-2">{r.ts.slice(11)}</td><td className="py-1 pr-2">{r.ref.slice(0, 14)}</td><td className="py-1 pr-2">{r.type}</td>
                  <td className="py-1 pr-2">{r.from.slice(0, 12)}→{r.to.slice(0, 12)}</td><td className="py-1 pr-2 text-right">{r.size?.toFixed(1)}</td><td className="py-1 font-sans">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h4 className="mt-4 font-sans text-xs font-semibold uppercase tracking-wider text-paper-muted">Limitations</h4>
          <ul className="list-disc pl-5">{t.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </Section>

        <Section n="5" title="Audit trail">
          <dl className="space-y-1 font-sans text-[12px]">
            {pkg.auditTrail.dataSources.map((s) => <div key={s.venue}><dt className="inline text-paper-muted">Data source: </dt><dd className="inline">{s.venue} — {s.source} ({s.mode})</dd></div>)}
            <div><dt className="inline text-paper-muted">Detector: </dt><dd className="inline font-mono">{pkg.auditTrail.detectorVersion}</dd></div>
            <div><dt className="inline text-paper-muted">Legal templates: </dt><dd className="inline font-mono">{pkg.auditTrail.legalTemplates.marc} · {pkg.auditTrail.legalTemplates.mica}</dd></div>
            <div><dt className="inline text-paper-muted">Dataset SHA-256 ({pkg.auditTrail.datasetRecordCount} records): </dt><dd className="inline break-all font-mono text-[11px]">{pkg.auditTrail.datasetHash}</dd></div>
            <div><dt className="inline text-paper-muted">Package SHA-256: </dt><dd className="inline break-all font-mono text-[11px]">{pkg.auditTrail.packageHash}</dd></div>
          </dl>
          {pkg.auditTrail.events.length > 0 && (
            <table className="mt-3 w-full border-collapse font-sans text-[11.5px]">
              <tbody>{pkg.auditTrail.events.map((e, i) => <tr key={i} className="border-b border-paper-border/70"><td className="py-1 pr-3 font-mono">{e.ts}</td><td className="py-1 pr-3">{e.role}</td><td className="py-1 pr-3 font-medium">{e.action}</td><td className="py-1 text-paper-muted">{e.detail}</td></tr>)}</tbody>
            </table>
          )}
        </Section>

        <footer className="mt-8 border-t border-paper-border pt-4 font-sans text-[11px] italic text-paper-muted">{pkg.disclaimer}</footer>
      </article>
    </div>
  );
}

function Section({ n, title, children, breakBefore }: { n: string; title: string; children: ReactNode; breakBefore?: boolean }) {
  return (
    <section className={`mt-8 ${breakBefore ? "print-page-break" : ""}`}>
      <h2 className="mb-3 border-b border-paper-border pb-1 font-sans text-lg font-semibold"><span className="mr-2 font-mono text-paper-accent">{n}</span>{title}</h2>
      {children}
    </section>
  );
}

function LegalBlock({ m, edited }: { m: LegalMapping; edited: boolean }) {
  return (
    <div className="space-y-3">
      <p className="font-sans text-[11px] text-paper-muted">Template {m.templateVersion} — {m.instrument}</p>
      <div>
        <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-paper-muted">Potentially engaged elements</h4>
        {m.engaged.map((e) => (
          <div key={e.element.id} className="mt-2">
            <p><strong>{e.element.citation} — {e.element.title}</strong> <span className="font-sans text-[11px] text-paper-muted">({STRENGTH_LABEL[e.strength]})</span></p>
            <p className="text-paper-muted italic">{e.element.summary}</p>
            <p>{e.rationale}</p>
          </div>
        ))}
      </div>
      <div>
        <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-paper-muted">Factual narrative{edited ? " (edited by analyst)" : ""}</h4>
        <p className="mt-1">{m.narrative}</p>
      </div>
      <div>
        <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-paper-muted">Indicators relevant to intent or knowledge</h4>
        <ul className="mt-1 list-disc pl-5">{m.intentIndicators.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
      <div className="border-l-4 border-paper-foreground/60 pl-4">
        <h4 className="font-sans text-xs font-semibold uppercase tracking-wider">Counter-arguments — why this may not constitute market abuse</h4>
        <ul className="mt-1 list-disc pl-5">{m.counterArguments.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
      <div>
        <h4 className="font-sans text-xs font-semibold uppercase tracking-wider text-paper-muted">Suggested next steps</h4>
        <ol className="mt-1 list-decimal pl-5">{m.nextSteps.map((x) => <li key={x}>{x}</li>)}</ol>
      </div>
      <p className="font-sans text-[11px] italic text-paper-muted">{m.caveat}</p>
    </div>
  );
}
