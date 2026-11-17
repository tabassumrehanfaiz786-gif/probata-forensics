import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Banknote, FileDown, FileJson, FileText, MessageSquare, Radio, ScanSearch, TrendingUp, Scale } from "lucide-react";
import { toast } from "sonner";

import { ActivityChart } from "@/components/forge/ActivityChart";
import { ConfidenceBadge, Panel, PatternTag, StatusBadge } from "@/components/forge/badges";
import { LegalPanel } from "@/components/forge/LegalPanel";
import { ScoreBreakdown } from "@/components/forge/ScoreBreakdown";
import { StatusActions } from "@/components/forge/StatusActions";
import { WalletGraph } from "@/components/forge/WalletGraph";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadText, toMarkdown } from "@/lib/forge/evidence";
import { fmtCompact, fmtDuration, fmtPrice, fmtTs, shortAddr } from "@/lib/forge/format";
import { can } from "@/lib/forge/permissions";
import { useForge } from "@/lib/forge/store";
import type { Detection, TimelineEvent } from "@/lib/forge/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cases/$caseId")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.caseId} — Investigation — Probata Forensics` },
      { name: "description", content: `Investigation workspace for case ${params.caseId}: timeline, wallet graph, MARC and MiCA legal analysis, and evidence package.` },
      { property: "og:title", content: `${params.caseId} — Investigation — Probata Forensics` },
      { property: "og:description", content: `Investigation workspace for case ${params.caseId}: timeline, wallet graph, MARC and MiCA legal analysis.` },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});

function Workspace() {
  const { caseId } = Route.useParams();
  const { detections, statusOf, settings } = useForge();
  const d = detections.find((x) => x.caseRef === caseId);

  if (!d) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-lg font-semibold">Case {caseId} not found</h1>
        <Link to="/cases" className="mt-3 inline-block text-sm text-primary hover:underline">Back to case library</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5 lg:p-6">
      <Link to="/cases" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Case library
      </Link>
      <div className="flex flex-wrap items-start gap-4">
        <ConfidenceBadge value={d.confidence} className="h-12 min-w-14 text-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-semibold">{d.caseRef}</h1>
            <PatternTag pattern={d.pattern} full />
            {d.suppressed ? <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Suppressed — below threshold {settings.minConfidence}</span> : <StatusBadge status={statusOf(d.caseRef)} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {d.pair} · {d.venue.name}{d.venue.chain ? ` (${d.venue.chain})` : ""} · {fmtTs(d.window.start)} → {fmtTs(d.window.end)} ({fmtDuration(d.window.end - d.window.start)}) · {d.assignee}
          </p>
          <p className="mt-2 max-w-3xl text-sm">{d.summary}</p>
        </div>
        {!d.suppressed && <StatusActions caseRef={d.caseRef} />}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-auto flex-wrap justify-start bg-card">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="wallets">Wallets</TabsTrigger>
          <TabsTrigger value="marc">UK MARC</TabsTrigger>
          <TabsTrigger value="mica">MiCA Art. 91</TabsTrigger>
          <TabsTrigger value="evidence">Evidence package</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <div className="space-y-5">
              <Panel title="Price & volume" action={<span className="font-mono text-[10px] text-muted-foreground"><span className="text-alert">■</span> flagged volume · <span className="text-primary">—</span> price · shaded: detection window</span>}>
                <ActivityChart d={d} />
              </Panel>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {d.metrics.map((m) => (
                  <div key={m.label} className="rounded-md border border-border bg-card px-3 py-2.5">
                    <div className="label-caps">{m.label}</div>
                    <div className="mt-1 font-mono text-lg tabular-nums">{m.value}</div>
                    {m.hint && <div className="text-xs text-muted-foreground">{m.hint}</div>}
                  </div>
                ))}
              </div>
              <Panel title="Limitations of this detection">
                <ul className="space-y-1.5 text-sm">
                  {d.limitations.map((l) => <li key={l} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />{l}</li>)}
                </ul>
              </Panel>
            </div>
            <Panel title="Why this score">
              <ScoreBreakdown d={d} threshold={settings.minConfidence} />
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Panel title="Factual timeline (UTC)">
            <Timeline events={d.timeline} />
          </Panel>
        </TabsContent>

        <TabsContent value="wallets" className="mt-4 space-y-5">
          <Panel title="Wallet cluster">
            <WalletGraph d={d} />
          </Panel>
          <Panel title="Subject wallets" bodyClassName="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left">{["Address / account", "Cluster", "Bought", "Sold", "Trades"].map((h) => <th key={h} className="label-caps px-4 py-2 font-normal">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border font-mono text-xs">
                {d.graph.nodes.filter((n) => n.role === "subject").map((n) => (
                  <tr key={n.id}><td className="break-all px-4 py-2">{n.id}</td><td className="px-4 py-2">{n.clusterId ?? "—"}</td><td className="px-4 py-2">{fmtCompact(n.buyVolume)}</td><td className="px-4 py-2">{fmtCompact(n.sellVolume)}</td><td className="px-4 py-2">{n.tradeCount}</td></tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </TabsContent>

        <TabsContent value="marc" className="mt-4"><Panel><LegalPanel d={d} regime="MARC" /></Panel></TabsContent>
        <TabsContent value="mica" className="mt-4"><Panel><LegalPanel d={d} regime="MiCA" /></Panel></TabsContent>
        <TabsContent value="evidence" className="mt-4"><EvidenceTab d={d} /></TabsContent>
      </Tabs>
    </div>
  );
}

const KIND_ICON: Record<TimelineEvent["kind"], typeof Banknote> = {
  funding: Banknote, trade: TrendingUp, order: Radio, social: MessageSquare, detection: ScanSearch, price: TrendingUp,
};

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative ml-3 border-l border-border">
      {events.map((e, i) => {
        const Icon = KIND_ICON[e.kind];
        return (
          <li key={i} className="relative pb-5 pl-6 last:pb-0">
            <span className={cn("absolute -left-3 top-0 grid h-6 w-6 place-items-center rounded-full border bg-background", e.kind === "detection" ? "border-primary text-primary" : e.kind === "social" ? "border-critical text-critical" : e.kind === "funding" ? "border-primary/60 text-primary" : "border-alert/60 text-alert")}>
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-mono text-xs text-muted-foreground">{fmtTs(e.ts)}</span>
              <span className="text-sm font-medium">{e.label}</span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{e.detail}</p>
            {e.ref && <p className="mt-0.5 break-all font-mono text-[11px] text-primary/80">ref {e.ref}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function EvidenceTab({ d }: { d: Detection }) {
  const { role, buildPackage, log } = useForge();
  const final = can(role, "export_final");
  const exportAs = async (fmt: "md" | "json") => {
    const pkg = await buildPackage(d.caseRef);
    if (!pkg) return;
    if (fmt === "md") downloadText(`${pkg.packageId}.md`, toMarkdown(pkg), "text/markdown");
    else downloadText(`${pkg.packageId}.json`, JSON.stringify(pkg, null, 2), "application/json");
    log(`Exported ${fmt === "md" ? "Markdown" : "JSON"} (${pkg.classification})`, d.caseRef, `sha256 ${pkg.auditTrail.packageHash.slice(0, 16)}…`);
    toast.success(`${pkg.packageId}.${fmt} downloaded`);
  };
  const sections = ["Executive summary", "Factual timeline with evidence references", "Legal characterisation — UK MARC", "Legal characterisation — MiCA Art. 91", "Technical evidence appendix", "Audit trail with dataset and package SHA-256"];
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Panel title="Generate package">
        <ol className="mb-4 space-y-1.5 text-sm">
          {sections.map((s, i) => <li key={s} className="flex gap-2"><span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>{s}</li>)}
        </ol>
        <div className={cn("mb-4 rounded border p-3 text-xs", final ? "border-success/40 text-success" : "border-alert/40 text-alert")}>
          {final ? "Your role can export FINAL packages." : "Analyst exports are watermarked DRAFT until reviewed by Compliance."}
        </div>
        <div className="grid gap-2">
          <Button asChild>
            <Link to="/report/$caseId" params={{ caseId: d.caseRef }}><FileDown className="mr-2 h-4 w-4" /> Open printable package (PDF)</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/filings/$caseId" params={{ caseId: d.caseRef }}><Scale className="mr-2 h-4 w-4" /> FCA STOR / MiCA filings</Link>
          </Button>
          <Button variant="outline" onClick={() => exportAs("md")}><FileText className="mr-2 h-4 w-4" /> Download Markdown</Button>
          <Button variant="outline" onClick={() => exportAs("json")}><FileJson className="mr-2 h-4 w-4" /> Download JSON</Button>
        </div>
      </Panel>
      <Panel title={`Evidence records (${d.evidence.length})`} bodyClassName="p-0">
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card"><tr className="border-b border-border text-left">{["Time (UTC)", "Ref", "Type", "From → To", "Price", "Size", "Note"].map((h) => <th key={h} className="label-caps px-3 py-2 font-normal">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-border font-mono">
              {d.evidence.map((e, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">{fmtTs(e.ts).slice(11)}</td>
                  <td className="px-3 py-1.5 text-primary/80">{shortAddr(e.ref)}</td>
                  <td className="px-3 py-1.5">{e.type}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{shortAddr(e.from)} → {shortAddr(e.to)}</td>
                  <td className="px-3 py-1.5">{e.price != null ? fmtPrice(e.price) : ""}</td>
                  <td className="px-3 py-1.5">{e.size != null ? fmtCompact(e.size) : ""}</td>
                  <td className="px-3 py-1.5 font-sans text-muted-foreground">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
