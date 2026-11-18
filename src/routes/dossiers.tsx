import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Gavel } from "lucide-react";

import { DOSSIERS } from "@/lib/forge/dossiers";

export const Route = createFileRoute("/dossiers")({
  head: () => ({
    meta: [
      { title: "Enforcement Dossiers · Probata Forensics" },
      { name: "description", content: "Real crypto market-manipulation enforcement cases mapped to UK MAR and MiCA, with official sources." },
      { property: "og:title", content: "Enforcement Dossiers · Probata Forensics" },
      { property: "og:description", content: "Mango Markets, Operation Token Mirrors and UK FCA benchmarks mapped to market abuse law." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dossiers,
});

function Dossiers() {
  return (
    <div className="space-y-6 p-6">
      <header>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary"><Gavel className="h-3.5 w-3.5" />Real-world record</div>
        <h1 className="mt-1 text-2xl font-semibold">Enforcement Dossiers</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Public enforcement actions used to benchmark Probata's detectors. Facts are summarised from official agency and court records — open the sources and confirm current status before citing.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {DOSSIERS.map((d) => (
          <article key={d.id} className="space-y-3 rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold">{d.title}</h2>
              <span className="font-mono text-xs text-muted-foreground">{d.year}</span>
            </div>
            <p className="text-sm text-muted-foreground">{d.typology} · {d.jurisdiction}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">{d.facts.map((f) => <li key={f}>{f}</li>)}</ul>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Proceedings</div>
              <ul className="mt-1 space-y-1 text-sm">{d.proceedings.map((p) => <li key={p.forum}><span className="font-medium">{p.forum}:</span> {p.outcome}</li>)}</ul>
            </div>
            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded border border-border p-2"><span className="font-mono text-primary">UK MAR</span><p className="mt-1">{d.ukMar}</p></div>
              <div className="rounded border border-border p-2"><span className="font-mono text-primary">MiCA</span><p className="mt-1">{d.mica}</p></div>
            </div>
            <p className="text-sm italic">{d.lesson}</p>
            <div className="flex flex-wrap gap-3 text-xs">
              {d.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">{s.label}<ExternalLink className="h-3 w-3" /></a>)}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
