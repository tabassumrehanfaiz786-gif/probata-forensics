import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ExternalLink, FlaskConical, XCircle } from "lucide-react";
import { useMemo } from "react";

import { PATTERN_LABEL } from "@/lib/forge/format";
import { BENCHMARK_TRUTH, confusion, scoreBenchmark, scoreReconstructions, thresholdSweep } from "@/lib/forge/methodology";
import { DEFAULT_SETTINGS } from "@/lib/forge/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Detector Methodology & Validation · Probata Forensics" },
      { name: "description", content: "How Probata's market-abuse detectors score on a labelled benchmark suite and on reconstructions of Mango Markets, Operation Token Mirrors and an FCA spoofing case." },
      { property: "og:title", content: "Detector Methodology & Validation · Probata Forensics" },
      { property: "og:description", content: "Precision, recall and historical-event reconstructions with every parameter cited or marked as assumed." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Methodology,
});

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

function Methodology() {
  const bench = useMemo(() => scoreBenchmark(), []);
  const cm = useMemo(() => confusion(bench), [bench]);
  const sweep = useMemo(() => thresholdSweep(), []);
  const recon = useMemo(() => scoreReconstructions(), []);
  const th = DEFAULT_SETTINGS.minConfidence;

  return (
    <div className="space-y-8 p-6">
      <header>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary"><FlaskConical className="h-3.5 w-3.5" />Validation</div>
        <h1 className="mt-1 text-2xl font-semibold">Detector methodology</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Scores below are recomputed in your browser from the same detector code that scores live and library cases, at the default alert threshold of {th}. Two evidence bases are kept apart: a labelled benchmark suite with known ground truth, and reconstructions of documented enforcement events built from figures in official complaints and notices.</p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">1 · Labelled benchmark suite</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {[["Precision", pct(cm.precision), `${cm.tp} of ${cm.tp + cm.fp} alerts correct`], ["Recall", pct(cm.recall), `${cm.tp} of ${cm.tp + cm.fn} manipulative cases caught`], ["F1", cm.f1.toFixed(2), "balance of the two"], ["Accuracy", pct(cm.accuracy), `${bench.length} cases`]].map(([k, v, s]) => (
            <div key={k} className="rounded-lg border border-border bg-card p-4"><div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{v}</div><div className="mt-1 text-xs text-muted-foreground">{s}</div></div>
          ))}
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left">{["Case", "Pattern", "Ground truth", "Basis", "Confidence", "Result"].map((h) => <th key={h} className="label-caps px-3 py-2 font-normal">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {bench.map((b) => {
                const ok = b.flagged === (b.truth === "manipulative");
                return (
                  <tr key={b.caseRef}>
                    <td className="px-3 py-2 font-mono text-xs"><Link to="/cases/$caseId" params={{ caseId: b.caseRef }} className="text-primary hover:underline">{b.caseRef}</Link></td>
                    <td className="px-3 py-2 text-xs">{PATTERN_LABEL[b.pattern]}</td>
                    <td className="px-3 py-2 text-xs capitalize">{b.truth}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{BENCHMARK_TRUTH[b.caseRef]?.basis}</td>
                    <td className="px-3 py-2 font-mono text-xs tabular-nums">{b.confidence}</td>
                    <td className="px-3 py-2 text-xs"><span className={cn("inline-flex items-center gap-1", ok ? "text-success" : "text-destructive")}>{ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{b.flagged ? (ok ? "True positive" : "False positive") : ok ? "True negative" : "False negative"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Threshold sweep</div>
          <table className="mt-2 w-full max-w-xl font-mono text-xs tabular-nums">
            <thead><tr className="text-left text-muted-foreground">{["Alert at ≥", "Precision", "Recall", "F1", "FP", "FN"].map((h) => <th key={h} className="py-1 font-normal">{h}</th>)}</tr></thead>
            <tbody>{sweep.map((s) => <tr key={s.threshold} className={cn(s.threshold === th && "text-primary")}><td className="py-1">{s.threshold}</td><td>{pct(s.precision)}</td><td>{pct(s.recall)}</td><td>{s.f1.toFixed(2)}</td><td>{s.fp}</td><td>{s.fn}</td></tr>)}</tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">The suite is small (nine cases) and synthetic, so these figures show the detectors behave as designed — they are not a field error rate.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">2 · Historical-event reconstructions</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">No regulator has published the account-level tape for these events, so each is rebuilt as synthetic records using the figures the official documents state (<span className="text-primary">cited</span>) plus clearly marked <span className="text-alert">assumed</span> values where the record is silent. The question is whether the detector logic would have raised a lead — not whether anyone is guilty.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {recon.map(({ rc, result, reading }) => (
            <article key={rc.id} className={cn("space-y-3 rounded-lg border bg-card p-5", result.flagged ? "border-success/40" : "border-destructive/50")}>
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-semibold">{rc.event}</h3><p className="text-xs text-muted-foreground">{rc.date} · {rc.legalStatus}</p></div>
                <div className="text-right"><div className={cn("text-2xl font-semibold tabular-nums", result.flagged ? "text-success" : "text-destructive")}>{result.confidence}</div><div className="font-mono text-[10px] uppercase text-muted-foreground">{result.flagged ? "lead raised" : "missed"}</div></div>
              </div>
              <p className="text-sm">{rc.question}</p>
              <ul className="space-y-1 text-xs">
                {rc.params.map((p) => (
                  <li key={p.name} className="flex gap-2">
                    <span className={cn("w-14 shrink-0 font-mono text-[10px] uppercase", p.kind === "cited" ? "text-primary" : "text-alert")}>{p.kind}</span>
                    <span className="flex-1"><span className="text-muted-foreground">{p.name}:</span> {p.value}{p.source && <a href={p.source} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline">source{p.pin ? ` ${p.pin}` : ""}<ExternalLink className="h-3 w-3" /></a>}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded border border-border p-2 text-xs"><span className="font-mono text-[10px] uppercase text-muted-foreground">Strongest factors · </span>{result.topFactors.join(" · ")}</div>
              <p className="text-sm italic">{reading}</p>
              <Link to="/dossiers" hash={rc.dossierId} className="text-xs text-primary hover:underline">Read the dossier →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-card p-5 text-sm">
        <h2 className="text-lg font-semibold">3 · Limits of this validation</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Reconstructions inherit their assumed values; change them and the score changes. They test the logic, not the original evidence.</li>
          <li>Live public tape has no account identity, so live leads are capped at 50 and need venue or KYC data before attribution.</li>
          <li>The Mango Markets criminal convictions were vacated in May 2025; the civil allegations are allegations, not findings.</li>
          <li>The FCA case concerns equities and is used only as a method benchmark for spoofing evidence.</li>
        </ul>
      </section>
    </div>
  );
}
