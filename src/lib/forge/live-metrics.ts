// Pure rolling-window microstructure metrics over public, anonymised trade ticks.
// Outputs are investigative leads only: public tape carries no account identity.
export interface LiveTick { id: number; ts: number; price: number; qty: number; buy: boolean }
export interface LiveThresholds { repeatShare: number; burstZ: number; churnRatio: number; imbalance: number }
export const DEFAULT_LIVE_THRESHOLDS: LiveThresholds = { repeatShare: 0.25, burstZ: 3, churnRatio: 40, imbalance: 0.75 };
export const BUFFER_SIZE = 500;

export interface LiveMetrics {
  n: number; volume: number; repeatShare: number; topLot: number | null; burstZ: number;
  churnRatio: number; imbalance: number; tradesPerSec: number;
}
export interface LiveAlert { kind: "wash" | "burst" | "churn" | "pressure"; label: string; statute: string; value: string }

export function pushTick(buf: LiveTick[], t: LiveTick, size = BUFFER_SIZE): LiveTick[] {
  const next = buf.length >= size ? buf.slice(buf.length - size + 1) : buf.slice();
  next.push(t);
  return next;
}

export function computeMetrics(buf: LiveTick[]): LiveMetrics {
  const n = buf.length;
  if (n < 2) return { n, volume: 0, repeatShare: 0, topLot: null, burstZ: 0, churnRatio: 0, imbalance: 0, tradesPerSec: 0 };
  let volume = 0, buyV = 0;
  const lots = new Map<string, number>();
  for (const t of buf) { volume += t.qty; if (t.buy) buyV += t.qty; const k = t.qty.toFixed(5); lots.set(k, (lots.get(k) ?? 0) + 1); }
  let topLot: number | null = null, topC = 0;
  for (const [k, c] of lots) if (c > topC) { topC = c; topLot = Number(k); }
  const repeatShare = topC > 1 ? topC / n : 0;
  // Burst: trade count in last 1s vs per-second distribution across the window.
  const t0 = buf[0]!.ts, t1 = buf[n - 1]!.ts;
  const secs = Math.max(1, Math.ceil((t1 - t0) / 1000));
  const bins = new Array<number>(secs + 1).fill(0);
  for (const t of buf) bins[Math.floor((t.ts - t0) / 1000)]!++;
  const last = bins[bins.length - 1]!, prev = bins.slice(0, -1);
  const mean = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : last;
  const sd = prev.length ? Math.sqrt(prev.reduce((a, b) => a + (b - mean) ** 2, 0) / prev.length) : 0;
  const burstZ = sd > 0 ? (last - mean) / sd : 0;
  // Churn: volume per unit of relative price range (bps). High volume with no price movement.
  let hi = -Infinity, lo = Infinity;
  for (const t of buf) { hi = Math.max(hi, t.price); lo = Math.min(lo, t.price); }
  const rangeBps = ((hi - lo) / lo) * 1e4;
  const churnRatio = volume / Math.max(rangeBps, 0.5);
  const imbalance = volume > 0 ? Math.abs(2 * buyV - volume) / volume : 0;
  return { n, volume, repeatShare, topLot, burstZ, churnRatio, imbalance, tradesPerSec: n / Math.max(1, (t1 - t0) / 1000) };
}

export function liveAlerts(m: LiveMetrics, th: LiveThresholds = DEFAULT_LIVE_THRESHOLDS): LiveAlert[] {
  if (m.n < 50) return [];
  const a: LiveAlert[] = [];
  if (m.repeatShare >= th.repeatShare) a.push({ kind: "wash", label: "Repeated identical lot sizes", statute: "UK MAR Art. 12(1)(a) · MiCA Art. 91(2)(a)", value: `${(m.repeatShare * 100).toFixed(0)}% @ ${m.topLot}` });
  if (m.burstZ >= th.burstZ) a.push({ kind: "burst", label: "Trade-velocity burst", statute: "UK MAR Art. 12(1)(a) · pump indicator", value: `z = ${m.burstZ.toFixed(1)}` });
  if (m.churnRatio >= th.churnRatio) a.push({ kind: "churn", label: "High churn, flat price", statute: "UK MAR Art. 12(1)(a) · wash indicator", value: m.churnRatio.toFixed(1) });
  if (m.imbalance >= th.imbalance) a.push({ kind: "pressure", label: "One-sided aggressor pressure", statute: "UK MAR Art. 12(1)(b) · MiCA Art. 91(2)(b)", value: `${(m.imbalance * 100).toFixed(0)}%` });
  return a;
}
