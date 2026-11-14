import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/forge/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { DETECTOR_VERSIONS } from "@/lib/forge/detection";
import { PATTERN_LABEL, ROLE_LABEL } from "@/lib/forge/format";
import { LEGAL_TEMPLATES } from "@/lib/forge/legal";
import { can, PERMISSION_MATRIX, type Permission } from "@/lib/forge/permissions";
import { ALL_VENUES } from "@/lib/forge/scenarios";
import { useForge } from "@/lib/forge/store";
import { DEFAULT_SETTINGS, type DetectionSettings, type Role } from "@/lib/forge/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — EvidenceForge" },
      { name: "description", content: "Detection thresholds, data sources, legal template versions and role permissions." },
      { property: "og:title", content: "Settings — EvidenceForge" },
      { property: "og:description", content: "Detection thresholds, data sources, legal template versions and role permissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

const PERM_LABEL: Record<Permission, string> = {
  mark_under_review: "Mark case under review",
  escalate: "Escalate case",
  dismiss: "Dismiss case",
  reopen: "Reopen case",
  edit_narrative: "Edit legal narrative",
  export_final: "Export FINAL package",
  edit_settings: "Change detection settings",
};

function Num({ label, value, onChange, step = 1, suffix, disabled }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string; disabled: boolean }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <Input type="number" step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className="h-8 w-28 font-mono text-sm" />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function SettingsPage() {
  const { role, settings, updateSettings, detections } = useForge();
  const [draft, setDraft] = useState<DetectionSettings>(settings);
  useEffect(() => setDraft(settings), [settings]);
  const editable = can(role, "edit_settings");
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const preview = detections.filter((d) => d.confidence >= draft.minConfidence).length;
  const set = <K extends keyof DetectionSettings>(k: K, v: DetectionSettings[K]) => setDraft((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-5 p-5 lg:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">Changes re-run every detector immediately and are recorded in the audit log.</p>
        </div>
        {!editable && <span className="ml-auto inline-flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> Read-only — switch to Admin to edit</span>}
      </div>

      <Panel title="Detection thresholds" action={editable && (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setDraft(DEFAULT_SETTINGS)}>Defaults</Button>
          <Button size="sm" disabled={!dirty} onClick={() => { if (updateSettings(draft)) toast.success("Settings saved — detectors re-run"); }}>Save &amp; re-run</Button>
        </div>
      )}>
        <div className="space-y-6">
          <div className="max-w-xl">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Alert threshold</span>
              <span className="font-mono text-lg text-alert">{draft.minConfidence}</span>
            </div>
            <Slider className="mt-3" min={30} max={95} step={1} value={[draft.minConfidence]} disabled={!editable} onValueChange={([v]) => set("minConfidence", v)} aria-label="Alert threshold" />
            <p className="mt-2 text-xs text-muted-foreground">Candidates below this score are suppressed, not deleted. At {draft.minConfidence}, {preview} of {detections.length} candidates would raise a case. Higher favours precision.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <fieldset className="space-y-3 rounded border border-border p-4">
              <legend className="px-1 text-sm font-medium">{PATTERN_LABEL.wash_trading} <span className="font-mono text-[10px] text-muted-foreground">{DETECTOR_VERSIONS.wash_trading}</span></legend>
              <Num disabled={!editable} label="Max seconds between offsetting legs" value={draft.wash.maxPairSeconds} suffix="s" onChange={(v) => set("wash", { ...draft.wash, maxPairSeconds: v })} />
              <Num disabled={!editable} label="Size tolerance" value={draft.wash.sizeTolerancePct} step={0.5} suffix="%" onChange={(v) => set("wash", { ...draft.wash, sizeTolerancePct: v })} />
              <Num disabled={!editable} label="Minimum matched pairs" value={draft.wash.minPairs} onChange={(v) => set("wash", { ...draft.wash, minPairs: v })} />
            </fieldset>
            <fieldset className="space-y-3 rounded border border-border p-4">
              <legend className="px-1 text-sm font-medium">{PATTERN_LABEL.spoofing} <span className="font-mono text-[10px] text-muted-foreground">{DETECTOR_VERSIONS.spoofing}</span></legend>
              <Num disabled={!editable} label="Large order = multiple of venue median" value={draft.spoof.sizeMultiple} step={0.5} suffix="×" onChange={(v) => set("spoof", { ...draft.spoof, sizeMultiple: v })} />
              <Num disabled={!editable} label="Max lifetime counted as fleeting" value={draft.spoof.maxLifetimeMs} step={100} suffix="ms" onChange={(v) => set("spoof", { ...draft.spoof, maxLifetimeMs: v })} />
              <Num disabled={!editable} label="Minimum orders per account" value={draft.spoof.minOrders} onChange={(v) => set("spoof", { ...draft.spoof, minOrders: v })} />
            </fieldset>
            <fieldset className="space-y-3 rounded border border-border p-4">
              <legend className="px-1 text-sm font-medium">{PATTERN_LABEL.coordinated_pump} <span className="font-mono text-[10px] text-muted-foreground">{DETECTOR_VERSIONS.coordinated_pump}</span></legend>
              <Num disabled={!editable} label="Volume z-score threshold" value={draft.pump.zThreshold} step={0.5} onChange={(v) => set("pump", { ...draft.pump, zThreshold: v })} />
              <Num disabled={!editable} label="Social look-back" value={draft.pump.socialLookbackMin} suffix="min" onChange={(v) => set("pump", { ...draft.pump, socialLookbackMin: v })} />
              <Num disabled={!editable} label="Exit look-ahead" value={draft.pump.dumpLookaheadMin} suffix="min" onChange={(v) => set("pump", { ...draft.pump, dumpLookaheadMin: v })} />
            </fieldset>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Data sources" bodyClassName="p-0">
          <ul className="divide-y divide-border text-sm">
            {ALL_VENUES.map((v) => (
              <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-10 font-mono text-[10px] text-muted-foreground">{v.kind}</span>
                <div className="flex-1">
                  <div>{v.name}{v.chain ? ` · ${v.chain}` : ""}</div>
                  <div className="text-xs text-muted-foreground">{v.source}</div>
                </div>
                <span className="rounded border border-alert/40 px-1.5 py-0.5 font-mono text-[10px] text-alert">REPLAY</span>
              </li>
            ))}
            <li className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-10 font-mono text-[10px] text-muted-foreground">CEX</span>
              <div className="flex-1"><div>Binance · BTC/USDT</div><div className="text-xs text-muted-foreground">Public aggTrade WebSocket — ingestion health only</div></div>
              <span className="rounded border border-success/40 px-1.5 py-0.5 font-mono text-[10px] text-success">LIVE</span>
            </li>
          </ul>
        </Panel>

        <Panel title="Legal definition versions" bodyClassName="p-0">
          <ul className="divide-y divide-border text-sm">
            {LEGAL_TEMPLATES.map((t) => (
              <li key={t.version} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{t.version}</span>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", t.status === "active" ? "border-success/40 text-success" : "border-border text-muted-foreground")}>{t.status}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">from {t.effective}</span>
                </div>
                <p className="mt-1 text-xs">{t.instrument}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.changelog} {t.elements.length ? `${t.elements.length} elements.` : ""}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Role permissions" bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border"><th className="label-caps px-4 py-2 text-left font-normal">Action</th>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <th key={r} className={cn("label-caps px-4 py-2 font-normal", r === role && "text-primary")}>{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {(Object.keys(PERMISSION_MATRIX) as Permission[]).map((p) => (
              <tr key={p}>
                <td className="px-4 py-2">{PERM_LABEL[p]}</td>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <td key={r} className="px-4 py-2 text-center font-mono">{PERMISSION_MATRIX[p].includes(r) ? <span className="text-success">✓</span> : <span className="text-muted-foreground">—</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
