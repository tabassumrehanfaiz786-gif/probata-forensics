import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Download, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { downloadText, type EvidencePackage } from "@/lib/forge/evidence";
import { admissibilityChecklist, buildMica, buildStor, filingToMarkdown, PRECEDENTS, type Filing } from "@/lib/forge/filings";
import { useForge } from "@/lib/forge/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/filings/$caseId")({
  head: ({ params }) => ({
    meta: [
      { title: `Regulatory filings ${params.caseId} · Probata Forensics` },
      { name: "description", content: "Draft FCA STOR and MiCA Art. 92 notifications with a Civil Evidence Act 1995 admissibility checklist." },
      { property: "og:title", content: `Regulatory filings ${params.caseId} · Probata Forensics` },
      { property: "og:description", content: "FCA STOR, MiCA Art. 92 drafts, admissibility checks and precedents." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Filings,
});

function FilingCard({ f, onExport }: { f: Filing; onExport: () => void }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{f.title}</h2>
          <p className="text-xs text-muted-foreground">{f.authority} · {f.basis}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onExport}><Download className="mr-1.5 h-4 w-4" />Export</Button>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        {f.sections.map((s) => (
          <div key={s.label}><dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</dt><dd className="mt-0.5 break-words">{s.value}</dd></div>
        ))}
      </dl>
    </section>
  );
}

function Filings() {
  const { caseId } = Route.useParams();
  const { ready, buildPackage, log } = useForge();
  const [pkg, setPkg] = useState<EvidencePackage | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    buildPackage(caseId).then((p) => { if (!live) return; if (p) setPkg(p); else setMissing(true); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, caseId]);

  if (missing) return <div className="p-10 text-center">Case {caseId} not found.</div>;
  if (!pkg) return <div className="p-10 text-center font-mono text-sm text-muted-foreground">Preparing filings…</div>;
  const stor = buildStor(pkg), mica = buildMica(pkg), checks = admissibilityChecklist(pkg);
  const exp = (f: Filing) => { downloadText(`${f.id}.md`, filingToMarkdown(f), "text/markdown"); log(`Exported ${f.id}`, caseId, f.authority); };
  const passed = checks.filter((c) => c.pass).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Link to="/cases/$caseId" params={{ caseId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to case</Link>
      <header>
        <div className="font-mono text-xs uppercase tracking-widest text-primary">Phase 3 · Regulatory filing engine</div>
        <h1 className="mt-1 text-2xl font-semibold">Filings for {pkg.caseRef}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Drafts only. Fill in firm details, verify every citation, and obtain compliance sign-off before submitting to a regulator.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <FilingCard f={stor} onExport={() => exp(stor)} />
        <FilingCard f={mica} onExport={() => exp(mica)} />
      </div>
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Admissibility checklist <span className="font-mono text-sm text-muted-foreground">{passed}/{checks.length}</span></h2>
        <ul className="mt-3 space-y-2">
          {checks.map((c) => (
            <li key={c.id} className="flex gap-3 rounded border border-border p-3 text-sm">
              {c.pass ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <XCircle className="h-5 w-5 shrink-0 text-destructive" />}
              <div><div className="font-medium">{c.label}</div><div className="font-mono text-[11px] text-primary">{c.law}</div><div className={cn("text-xs text-muted-foreground")}>{c.note}</div></div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Relevant precedents</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {PRECEDENTS.map((p) => (<li key={p.name}><span className="font-medium">{p.name}</span> <span className="font-mono text-xs text-muted-foreground">{p.cite}</span><div className="text-xs text-muted-foreground">{p.relevance}</div></li>))}
        </ul>
      </section>
    </div>
  );
}
