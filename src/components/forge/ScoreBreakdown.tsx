import { CONFIDENCE_CAP } from "@/lib/forge/detection";
import type { Detection } from "@/lib/forge/types";
import { cn } from "@/lib/utils";

import { bandText } from "./badges";

export function ScoreBreakdown({ d, threshold }: { d: Detection; threshold: number }) {
  const raw = d.factors.reduce((a, f) => a + f.score, 0);
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div>
          <div className="label-caps">Confidence</div>
          <div className={cn("font-mono text-4xl font-semibold tabular-nums", bandText(d.confidence))}>
            {d.confidence}
            <span className="text-base text-muted-foreground">/100</span>
          </div>
        </div>
        <div className="flex-1 pb-2">
          <div className="relative h-2 rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary via-alert to-critical" style={{ width: `${d.confidence}%` }} />
            <div className="absolute -top-1 h-4 w-px bg-foreground/70" style={{ left: `${threshold}%` }} title={`Alert threshold ${threshold}`} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>0</span>
            <span>threshold {threshold}</span>
            <span>cap {CONFIDENCE_CAP}</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Sum of {d.factors.length} bounded factors ({raw.toFixed(1)} raw{raw > CONFIDENCE_CAP ? `, capped at ${CONFIDENCE_CAP} because rule-based evidence never establishes certainty` : ""}). Detector {d.detectorVersion}.
      </p>
      <ul className="space-y-3">
        {d.factors.map((f) => (
          <li key={f.key} className="rounded border border-border bg-panel p-3">
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-medium">{f.label}</span>
              <span className="font-mono text-xs text-primary">{f.observed}</span>
              <span className="ml-auto font-mono text-xs tabular-nums text-foreground">
                {f.score.toFixed(1)} <span className="text-muted-foreground">/ {f.weight}</span>
              </span>
            </div>
            <div className="mt-2 h-1 rounded-full bg-muted">
              <div className="h-1 rounded-full bg-alert" style={{ width: `${(f.score / f.weight) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.rationale}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
