import { AlertTriangle, BookOpen, Pencil, RotateCcw, Scale } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { mapLegal, STRENGTH_LABEL, type Regime, type Strength } from "@/lib/forge/legal";
import { can } from "@/lib/forge/permissions";
import { useForge } from "@/lib/forge/store";
import type { Detection } from "@/lib/forge/types";
import { cn } from "@/lib/utils";

const STRENGTH_STYLE: Record<Strength, string> = {
  strong: "border-critical/40 text-critical",
  moderate: "border-alert/40 text-alert",
  limited: "border-border text-muted-foreground",
};

export function LegalPanel({ d, regime }: { d: Detection; regime: Regime }) {
  const { role, narrativeOf, setNarrative } = useForge();
  const m = mapLegal(d, regime);
  const edited = narrativeOf(d.caseRef, regime);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const canEdit = can(role, "edit_narrative");

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Scale className="h-4 w-4 text-primary" />
          <span className="font-medium">{regime === "MARC" ? "UK Market Abuse Regime for Cryptoassets" : "MiCA Article 91 — Prohibition of market manipulation"}</span>
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{m.templateVersion}</span>
        </div>
        <p className="text-xs text-muted-foreground">{m.instrument}</p>

        <section>
          <h3 className="label-caps mb-2">Potentially engaged elements</h3>
          {m.engaged.length === 0 && <p className="text-sm text-muted-foreground">No elements engaged on the available facts.</p>}
          <ul className="space-y-2">
            {m.engaged.map((e) => (
              <li key={e.element.id} className="rounded border border-border bg-panel p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-primary">{e.element.citation}</span>
                  <span className="text-sm font-medium">{e.element.title}</span>
                  <span className={cn("ml-auto rounded border px-1.5 py-0.5 text-[10px]", STRENGTH_STYLE[e.strength])}>{STRENGTH_LABEL[e.strength]}</span>
                </div>
                <p className="mt-1.5 text-xs italic leading-relaxed text-muted-foreground">{e.element.summary}</p>
                <p className="mt-2 text-sm leading-relaxed">{e.rationale}</p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="label-caps">Factual narrative</h3>
            <span className="text-[10px] text-muted-foreground">{edited ? "Edited by analyst" : "Generated from rule templates — no AI used"}</span>
            {canEdit && !editing && (
              <div className="ml-auto flex gap-1">
                {edited && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setNarrative(d.caseRef, regime, null)}>
                    <RotateCcw className="mr-1 h-3 w-3" /> Reset
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDraft(edited ?? m.narrative); setEditing(true); }}>
                  <Pencil className="mr-1 h-3 w-3" /> Edit
                </Button>
              </div>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={7} className="font-serif text-sm leading-relaxed" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={() => { setNarrative(d.caseRef, regime, draft.trim()); setEditing(false); }} disabled={!draft.trim()}>Save narrative</Button>
              </div>
            </div>
          ) : (
            <p className="rounded border border-border bg-panel p-4 font-serif text-[15px] leading-relaxed">{edited ?? m.narrative}</p>
          )}
        </section>

        <section>
          <h3 className="label-caps mb-2">Indicators relevant to intent or knowledge</h3>
          <ul className="space-y-1.5 text-sm">
            {m.intentIndicators.map((x) => (
              <li key={x} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-alert" />{x}</li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded border border-alert/40 bg-alert/5 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-alert"><AlertTriangle className="h-4 w-4" /> Counter-arguments</h3>
          <p className="mb-2 text-xs text-muted-foreground">Why this may not constitute market abuse.</p>
          <ul className="space-y-2 text-sm leading-relaxed">
            {m.counterArguments.map((x) => <li key={x} className="border-l-2 border-alert/40 pl-3">{x}</li>)}
          </ul>
        </section>
        <section className="rounded border border-border p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4 text-primary" /> Suggested next steps</h3>
          <ol className="list-decimal space-y-1.5 pl-4 text-sm">
            {m.nextSteps.map((x) => <li key={x}>{x}</li>)}
          </ol>
        </section>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{m.caveat}</p>
      </aside>
    </div>
  );
}
