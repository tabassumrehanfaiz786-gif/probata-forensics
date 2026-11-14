import type { ReactNode } from "react";

import { confidenceBand } from "@/lib/forge/detection";
import { PATTERN_CODE, PATTERN_LABEL, STATUS_LABEL } from "@/lib/forge/format";
import type { CaseStatus, PatternType } from "@/lib/forge/types";
import { cn } from "@/lib/utils";

const BAND: Record<ReturnType<typeof confidenceBand>, string> = {
  critical: "text-critical border-critical/40 bg-critical/10",
  high: "text-alert border-alert/40 bg-alert/10",
  moderate: "text-primary border-primary/40 bg-primary/10",
  low: "text-muted-foreground border-border bg-muted/40",
};

export function bandText(c: number) {
  return { critical: "text-critical", high: "text-alert", moderate: "text-primary", low: "text-muted-foreground" }[confidenceBand(c)];
}

export function ConfidenceBadge({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-[2.75rem] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums", BAND[confidenceBand(value)], className)}>
      {value}
    </span>
  );
}

export function PatternTag({ pattern, full }: { pattern: PatternType; full?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-foreground/85">
      <span className={cn("h-1.5 w-1.5 rounded-full", pattern === "wash_trading" ? "bg-primary" : pattern === "spoofing" ? "bg-alert" : "bg-critical")} />
      {full ? PATTERN_LABEL[pattern] : PATTERN_CODE[pattern]}
    </span>
  );
}

const STATUS_STYLE: Record<CaseStatus, string> = {
  new: "border-alert/40 text-alert",
  under_review: "border-primary/40 text-primary",
  escalated: "border-critical/50 bg-critical/10 text-critical",
  dismissed: "border-border text-muted-foreground",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

export function Panel({ title, action, children, className, bodyClassName }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("rounded-md border border-border bg-card", className)}>
      {title && (
        <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <h2 className="label-caps text-foreground/80">{title}</h2>
          <div className="ml-auto">{action}</div>
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
