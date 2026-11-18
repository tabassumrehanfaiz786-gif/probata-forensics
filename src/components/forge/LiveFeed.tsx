import { fmtTime } from "@/lib/forge/format";
import { PromoteLive } from "./PromoteLive";
import { useLiveStream } from "@/lib/forge/live-stream";
import { cn } from "@/lib/utils";

/** Sidebar view of the shared background live engine. */
export function LiveFeed() {
  const { buf, state, venue, base, rate, alerts } = useLiveStream();
  const ticks = buf.slice(-9).reverse();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className={cn("h-2 w-2 rounded-full", state === "live" ? "animate-pulse-dot bg-success" : "bg-alert")} />
        <span className="font-mono">{base.toUpperCase()} · {venue}</span>
        <span className="ml-auto font-mono text-muted-foreground">{state === "live" ? `${rate || "…"} trades/min` : state}</span>
      </div>
      {alerts.length > 0 && <p className="rounded border border-destructive/60 px-2 py-1 text-[11px] text-destructive">{alerts.length} live lead{alerts.length > 1 ? "s" : ""}: {alerts.map((a) => a.label).join(", ")}</p>}
      <PromoteLive />
      <table className="w-full font-mono text-[11px] tabular-nums">
        <tbody>
          {ticks.map((t) => (
            <tr key={`${t.id}-${t.ts}`} className="border-b border-border/50 last:border-0">
              <td className="py-1 text-muted-foreground">{fmtTime(t.ts)}</td>
              <td className={cn("py-1 text-right", t.buy ? "text-primary" : "text-alert")}>{t.price.toFixed(t.price < 1 ? 8 : 2)}</td>
              <td className="py-1 text-right text-foreground/80">{t.qty.toFixed(5)}</td>
            </tr>
          ))}
          {ticks.length === 0 && <tr><td className="py-2 text-muted-foreground">{state === "failover" ? "Switching exchange…" : "Waiting for trades…"}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
