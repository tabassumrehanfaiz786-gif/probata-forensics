import type { LiveAlert, LiveTick } from "./live-metrics";
import type { PatternType, Scenario } from "./types";

/** Public tape has no account identity: aggressor and resting side are recorded as anonymous roles. */
export const ANON_TAKER = "anon:aggressor";
export const ANON_MAKER = "anon:resting";

export function patternForAlerts(alerts: Pick<LiveAlert, "kind">[]): PatternType {
  return alerts.some((a) => a.kind === "wash" || a.kind === "churn") ? "wash_trading" : "coordinated_pump";
}

export function liveCaseRef(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, "0");
  return `PF-LIVE-${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/** Freeze a live tick window into a case record so it can be scored, hashed and filed like any other case. */
export function liveToScenario(buf: LiveTick[], alerts: Pick<LiveAlert, "kind" | "label">[], base: string, venue: string, now: number): Scenario {
  if (buf.length === 0) throw new Error("No live ticks to promote");
  const caseRef = liveCaseRef(now);
  const quote = "USD";
  const trades = buf.map((t, i) => ({
    id: `${caseRef}-t${i}`,
    ts: t.ts,
    buyer: t.buy ? ANON_TAKER : ANON_MAKER,
    seller: t.buy ? ANON_MAKER : ANON_TAKER,
    price: t.price,
    size: t.qty,
    ref: `${venue}#${t.id}`,
  }));
  return {
    id: `live-${now}`,
    caseRef,
    detector: patternForAlerts(alerts),
    pair: `${base.toUpperCase()}/${quote}`,
    base: base.toUpperCase(),
    quote,
    venue: { id: `live-${venue.toLowerCase().replace(/\W+/g, "-")}`, name: venue, kind: "CEX", source: `Live public trade feed (${venue})` },
    start: buf[0]!.ts,
    end: buf[buf.length - 1]!.ts,
    trades,
    orders: [],
    funding: [],
    social: [],
    services: [],
    labels: { [ANON_TAKER]: "Anonymous aggressor (public tape)", [ANON_MAKER]: "Anonymous resting side (public tape)" },
    defaultStatus: "new",
    assignee: "Unassigned",
    live: { promotedAt: now, alerts: alerts.map((a) => a.label), tickCount: buf.length },
  };
}
