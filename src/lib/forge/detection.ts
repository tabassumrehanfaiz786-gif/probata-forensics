/**
 * Rule-based detectors. Every score is a sum of named, bounded factors so an analyst can see
 * exactly why a number was produced. Thresholds favour precision over recall: candidates below
 * the minimum confidence are kept but suppressed, never silently discarded.
 */
import { fmtCompact, fmtNum, fmtTs, pct, shortAddr } from "./format";
import type {
  Cluster, Detection, DetectionSettings, EvidenceRecord, Metric, Scenario, ScoreFactor,
  SeriesPoint, TimelineEvent, Trade, WalletEdge, WalletNode,
} from "./types";

export const DETECTOR_VERSIONS = {
  wash_trading: "wash-heur 1.3.0",
  spoofing: "spoof-heur 1.1.2",
  coordinated_pump: "pump-heur 0.9.4",
} as const;

const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const factor = (key: string, label: string, weight: number, unit: number, observed: string, rationale: string): ScoreFactor => ({
  key, label, weight, observed, rationale, score: Math.round(weight * clamp(unit) * 10) / 10,
});

function buildSeries(s: Scenario, binMs: number, flagged: (t: Trade) => boolean): SeriesPoint[] {
  const n = Math.ceil((s.end - s.start) / binMs);
  const out: SeriesPoint[] = [];
  let last = s.trades[0]?.price ?? 0;
  let j = 0;
  const trades = s.trades;
  for (let i = 0; i < n; i++) {
    const t0 = s.start + i * binMs;
    const t1 = t0 + binMs;
    let vol = 0;
    let fl = 0;
    while (j < trades.length && trades[j].ts < t1) {
      if (trades[j].ts >= t0) {
        vol += trades[j].size;
        if (flagged(trades[j])) fl += trades[j].size;
        last = trades[j].price;
      }
      j++;
    }
    out.push({ t: t0, price: last, volume: vol, flagged: fl });
  }
  return out;
}

function buildGraph(s: Scenario, subjects: string[], clusters: Cluster[]): { nodes: WalletNode[]; edges: WalletEdge[] } {
  const subj = new Set(subjects);
  const clusterOf = new Map<string, string>();
  clusters.forEach((c) => c.wallets.forEach((w) => clusterOf.set(w, c.id)));
  const nodes = new Map<string, WalletNode>();
  const node = (id: string, role: WalletNode["role"]) => {
    let n = nodes.get(id);
    if (!n) {
      n = { id, role, clusterId: clusterOf.get(id), buyVolume: 0, sellVolume: 0, tradeCount: 0, label: s.labels[id] };
      nodes.set(id, n);
    }
    return n;
  };
  subjects.forEach((w) => node(w, "subject"));
  const edgeMap = new Map<string, WalletEdge>();
  const cpVol = new Map<string, number>();
  for (const t of s.trades) {
    const b = subj.has(t.buyer);
    const se = subj.has(t.seller);
    if (!b && !se) continue;
    if (b) { const n = node(t.buyer, "subject"); n.buyVolume += t.size; n.tradeCount++; }
    if (se) { const n = node(t.seller, "subject"); n.sellVolume += t.size; n.tradeCount++; }
    const cp = b && se ? null : b ? t.seller : t.buyer;
    if (cp) cpVol.set(cp, (cpVol.get(cp) ?? 0) + t.size);
    const key = `${t.seller}>${t.buyer}`;
    const e = edgeMap.get(key) ?? { from: t.seller, to: t.buyer, kind: "trade" as const, value: 0, count: 0 };
    e.value += t.size;
    e.count++;
    edgeMap.set(key, e);
  }
  const topCp = [...cpVol.entries()].sort((a, b) => b[1] - a[1]).slice(0, s.pool ? 1 : 6).map(([id]) => id);
  if (s.pool && !topCp.includes(s.pool)) topCp.unshift(s.pool);
  topCp.forEach((id) => {
    const n = node(id, id === s.pool ? "pool" : "counterparty");
    n.tradeCount = s.trades.filter((t) => t.buyer === id || t.seller === id).length;
  });
  const edges = [...edgeMap.values()].filter((e) => nodes.has(e.from) && nodes.has(e.to));
  for (const f of s.funding) {
    if (!subj.has(f.to)) continue;
    node(f.from, "funder");
    edges.push({ from: f.from, to: f.to, kind: "funding", value: f.amount, count: 1 });
  }
  return { nodes: [...nodes.values()], edges };
}

/** Candidate clusters: wallets sharing a non-service funder. Service addresses are excluded. */
export function fundingClusters(s: Scenario): Cluster[] {
  const services = new Set(s.services);
  const byFunder = new Map<string, Set<string>>();
  for (const f of s.funding) {
    if (services.has(f.from)) continue;
    if (!byFunder.has(f.from)) byFunder.set(f.from, new Set());
    byFunder.get(f.from)!.add(f.to);
  }
  let i = 0;
  return [...byFunder.entries()]
    .filter(([, ws]) => ws.size >= 2)
    .map(([funder, ws]) => ({ id: `C${++i}`, wallets: [...ws], funder, basis: `Common funding source ${shortAddr(funder)} (${ws.size} wallets)` }));
}

const tradeRecord = (t: Trade, note: string): EvidenceRecord => ({ ts: t.ts, ref: t.ref, type: "trade", from: t.seller, to: t.buyer, price: t.price, size: t.size, note });

/* ================================================================ WASH TRADING */
export function detectWash(s: Scenario, cfg: DetectionSettings): Detection {
  const totalVol = sum(s.trades.map((t) => t.size));
  const candidates: Cluster[] = fundingClusters(s);
  // singleton candidates: the most active accounts (covers self-trading / single-entity behaviour)
  const activity = new Map<string, number>();
  for (const t of s.trades) {
    if (t.buyer !== s.pool) activity.set(t.buyer, (activity.get(t.buyer) ?? 0) + t.size);
    if (t.seller !== s.pool) activity.set(t.seller, (activity.get(t.seller) ?? 0) + t.size);
  }
  [...activity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([w], i) => {
    candidates.push({ id: `S${i + 1}`, wallets: [w], basis: "Single high-activity account" });
  });

  const tol = cfg.wash.sizeTolerancePct / 100;
  const maxDt = cfg.wash.maxPairSeconds * 1000;

  const evaluate = (c: Cluster) => {
    const set = new Set(c.wallets);
    const ct = s.trades.filter((t) => set.has(t.buyer) || set.has(t.seller));
    const cross = ct.filter((t) => set.has(t.buyer) && set.has(t.seller));
    const legs = ct.filter((t) => !(set.has(t.buyer) && set.has(t.seller))).map((t) => ({ t, side: set.has(t.buyer) ? "buy" : "sell", used: false }));
    const pairs: [Trade, Trade][] = [];
    for (let i = 0; i < legs.length; i++) {
      const a = legs[i];
      if (a.used) continue;
      for (let j = i + 1; j < legs.length; j++) {
        const b = legs[j];
        if (b.t.ts - a.t.ts > maxDt) break;
        if (b.used || b.side === a.side) continue;
        if (Math.abs(b.t.size - a.t.size) / Math.max(a.t.size, b.t.size) <= tol) {
          a.used = b.used = true;
          pairs.push([a.t, b.t]);
          break;
        }
      }
    }
    const clusterVol = sum(ct.map((t) => t.size));
    const matchedVol = sum(cross.map((t) => t.size)) + sum(pairs.map(([a, b]) => a.size + b.size));
    let buy = 0, sell = 0;
    for (const t of ct) {
      if (set.has(t.buyer)) buy += t.size;
      if (set.has(t.seller)) sell += t.size;
    }
    const matchedRatio = clusterVol ? matchedVol / clusterVol : 0;
    const netRatio = buy + sell ? Math.abs(buy - sell) / (buy + sell) : 1;
    const venueShare = totalVol ? clusterVol / totalVol : 0;
    const nPairs = cross.length + pairs.length;
    const linked = c.wallets.length > 1 && !!c.funder;
    const factors = [
      factor("matched", "Matched / self-crossed volume", 35, matchedRatio / 0.8, pct(matchedRatio), `Share of the cluster's volume that was either crossed between cluster accounts or offset by a near-identical opposite trade within ${cfg.wash.maxPairSeconds}s (±${cfg.wash.sizeTolerancePct}% size). Full weight at ≥80%.`),
      factor("net", "Low net position change", 25, 1 - netRatio / 0.1, pct(netRatio), "Absolute net buy/sell imbalance as a share of gross volume. Genuine directional trading moves inventory; full weight when net change is ~0, none at ≥10%."),
      factor("funding", "Common beneficial control indicator", 20, linked ? 1 : 0, linked ? c.basis : "No shared funding link", "Wallets funded from the same non-service address within the look-back period suggest common control. Inferred from on-chain funding, not KYC."),
      factor("share", "Share of venue volume", 20, venueShare / 0.3, pct(venueShare), "Material share of reported volume increases the likelihood that other participants were misled about activity. Full weight at ≥30%."),
    ];
    let confidence = sum(factors.map((f) => f.score));
    const limitations: string[] = [];
    if (nPairs < cfg.wash.minPairs) {
      confidence *= 0.5;
      limitations.push(`Only ${nPairs} matched pairs (minimum ${cfg.wash.minPairs}); score halved to protect precision.`);
    }
    return { c, ct, cross, pairs, clusterVol, matchedVol, matchedRatio, netRatio, venueShare, nPairs, factors, confidence: Math.round(confidence), limitations, linked };
  };

  const best = candidates.map(evaluate).sort((a, b) => b.confidence - a.confidence)[0];
  const flaggedTrades = [...best.cross, ...best.pairs.flat()].sort((a, b) => a.ts - b.ts);
  const wStart = flaggedTrades[0]?.ts ?? s.start;
  const wEnd = flaggedTrades.at(-1)?.ts ?? s.end;
  const flaggedIds = new Set(flaggedTrades.map((t) => t.id));
  const first = flaggedTrades[0];
  const last = flaggedTrades.at(-1);
  const priceDrift = first && last ? last.price / first.price - 1 : 0;

  const clusters = [best.c];
  const timeline: TimelineEvent[] = [
    ...s.funding.filter((f) => best.c.wallets.includes(f.to)).map((f) => ({ ts: f.ts, kind: "funding" as const, label: "Funding transfer", detail: `${fmtNum(f.amount, 2)} ${f.asset} from ${shortAddr(f.from)} to ${shortAddr(f.to)}`, ref: f.ref })),
  ];
  if (first) timeline.push({ ts: first.ts, kind: "trade", label: "First matched trade", detail: `${fmtCompact(first.size)} ${s.base} @ ${first.price.toPrecision(5)} between ${shortAddr(first.seller)} → ${shortAddr(first.buyer)}`, ref: first.ref });
  if (best.cross[0]) timeline.push({ ts: best.cross[0].ts, kind: "trade", label: "First self-crossed trade", detail: `Both sides controlled by the cluster (${shortAddr(best.cross[0].seller)} → ${shortAddr(best.cross[0].buyer)})`, ref: best.cross[0].ref });
  if (best.pairs[0]) {
    const [a, b] = best.pairs[0];
    timeline.push({ ts: b.ts, kind: "trade", label: "Round-trip completed", detail: `Opposite leg ${Math.round((b.ts - a.ts) / 1000)}s later, size difference ${pct(Math.abs(b.size - a.size) / a.size, 2)}`, ref: b.ref });
  }
  if (last) timeline.push({ ts: last.ts, kind: "trade", label: "Last matched trade", detail: `${best.nPairs} matched pairs in total`, ref: last.ref });
  timeline.push({ ts: s.end + 12 * 60_000, kind: "detection", label: "Detection generated", detail: `${DETECTOR_VERSIONS.wash_trading} scored ${best.confidence}/100` });
  timeline.sort((a, b) => a.ts - b.ts);

  const metrics: Metric[] = [
    { label: "Matched pairs", value: fmtNum(best.nPairs), hint: `${best.cross.length} self-crossed · ${best.pairs.length} round-trips` },
    { label: "Matched volume", value: `${fmtCompact(best.matchedVol)} ${s.base}`, hint: pct(best.matchedRatio) + " of cluster volume" },
    { label: "Net position change", value: pct(best.netRatio, 2) },
    { label: "Share of venue volume", value: pct(best.venueShare) },
    { label: "Cluster size", value: `${best.c.wallets.length} ${best.c.wallets.length === 1 ? "account" : "accounts"}` },
    { label: "Price drift over window", value: pct(priceDrift, 2) },
  ];

  const limitations = [
    ...best.limitations,
    best.linked ? "Common control is inferred from funding links; venue KYC records have not been reviewed." : "No funding linkage — behaviour may reflect a single participant's legitimate inventory management.",
    s.venue.kind === "CEX" ? "Account identifiers are venue-assigned; the same beneficial owner may operate further accounts not visible in this dataset." : "On-chain round-trips may include arbitrage or router behaviour; MEV/bundle context has not been checked.",
    "Detection is rule-based on a single venue; cross-venue offsetting has not been examined.",
  ];

  return {
    id: s.id, caseRef: s.caseRef, pattern: "wash_trading", confidence: best.confidence,
    suppressed: best.confidence < cfg.minConfidence,
    window: { start: wStart, end: wEnd }, venue: s.venue, pair: s.pair,
    wallets: best.c.wallets, clusters, metrics,
    raw: { pairs: best.nPairs, cross: best.cross.length, roundTrips: best.pairs.length, matchedRatio: best.matchedRatio, netRatio: best.netRatio, venueShare: best.venueShare, clusterSize: best.c.wallets.length, matchedVol: best.matchedVol, priceDrift, linked: best.linked ? 1 : 0 },
    factors: best.factors, limitations, timeline,
    series: buildSeries(s, 5 * 60_000, (t) => flaggedIds.has(t.id)),
    graph: buildGraph(s, best.c.wallets, clusters),
    evidence: flaggedTrades.slice(0, 40).map((t) => tradeRecord(t, best.cross.includes(t) ? "Self-crossed (both sides in cluster)" : "Round-trip leg")),
    detectorVersion: DETECTOR_VERSIONS.wash_trading,
    summary: `${best.c.wallets.length}-account cluster generated ${pct(best.venueShare, 0)} of ${s.pair} volume on ${s.venue.name} with ${pct(best.netRatio, 1)} net position change.`,
    defaultStatus: s.defaultStatus, assignee: s.assignee,
  };
}

/* ================================================================ SPOOFING */
export function detectSpoof(s: Scenario, cfg: DetectionSettings): Detection {
  interface Ord { id: string; account: string; side: "bid" | "ask"; price: number; size: number; placed: number; end: number; terminal: "cancel" | "fill" }
  const map = new Map<string, Partial<Ord>>();
  for (const e of s.orders) {
    const o = map.get(e.orderId) ?? { id: e.orderId, account: e.account, side: e.side, price: e.price, size: e.size };
    if (e.action === "place") o.placed = e.ts;
    else { o.end = e.ts; o.terminal = e.action; }
    map.set(e.orderId, o);
  }
  const orders = [...map.values()].filter((o): o is Ord => o.placed != null && o.end != null);
  const venueMedian = median(orders.map((o) => o.size));
  const byAcct = new Map<string, Ord[]>();
  orders.forEach((o) => { if (!byAcct.has(o.account)) byAcct.set(o.account, []); byAcct.get(o.account)!.push(o); });

  const evaluate = (account: string, os: Ord[]) => {
    const cancelled = os.filter((o) => o.terminal === "cancel");
    const filled = os.filter((o) => o.terminal === "fill");
    const large = os.filter((o) => o.size >= cfg.spoof.sizeMultiple * venueMedian);
    const largeCancelled = large.filter((o) => o.terminal === "cancel");
    const life = median(largeCancelled.map((o) => o.end - o.placed));
    const ctf = cancelled.length / Math.max(1, filled.length);
    const largeShare = os.length ? large.length / os.length : 0;
    // fills on the opposite side while a large order was resting
    const oppFills = filled.filter((f) => largeCancelled.some((l) => l.side !== f.side && f.end >= l.placed && f.end <= l.end));
    const oppFrac = filled.length ? oppFills.length / filled.length : 0;
    const dominantSide = largeCancelled.filter((o) => o.side === "ask").length >= largeCancelled.length / 2 ? "ask" : "bid";
    const factors = [
      factor("ctf", "Cancel-to-fill ratio", 20, (ctf - 3) / 27, `${ctf.toFixed(1)} : 1`, "Ratio of cancelled to filled orders. Market makers routinely cancel, so this factor alone is weak; scoring starts above 3:1 and reaches full weight at ≥30:1."),
      factor("life", "Short life of large orders", 25, largeCancelled.length ? 1 - (life / cfg.spoof.maxLifetimeMs) * 0.6 : 0, largeCancelled.length ? `${fmtNum(life)} ms median` : "No large cancelled orders", `Median resting time of cancelled orders ≥${cfg.spoof.sizeMultiple}× venue median size. Zero if above ${fmtNum(cfg.spoof.maxLifetimeMs)} ms.`),
      factor("size", "Large orders relative to book", 20, largeShare / 0.6, pct(largeShare), `Share of the account's orders at ≥${cfg.spoof.sizeMultiple}× the venue median order size (${fmtNum(venueMedian)} ${s.base}).`),
      factor("opp", "Opposite-side execution while resting", 35, oppFrac / 0.8, pct(oppFrac), "Share of the account's fills that executed on the opposite side while its own large order was resting — the core economic signature of spoofing. Full weight at ≥80%."),
    ];
    if (largeCancelled.length === 0 || life > cfg.spoof.maxLifetimeMs) factors[1].score = 0;
    let confidence = sum(factors.map((f) => f.score));
    const lim: string[] = [];
    if (os.length < cfg.spoof.minOrders) { confidence *= 0.5; lim.push(`Only ${os.length} orders (minimum ${cfg.spoof.minOrders}); score halved.`); }
    return { account, os, cancelled, filled, large, largeCancelled, life, ctf, largeShare, oppFills, oppFrac, factors, confidence: Math.round(confidence), lim, dominantSide };
  };

  const best = [...byAcct.entries()]
    .filter(([, os]) => os.length >= 5)
    .map(([a, os]) => evaluate(a, os))
    .sort((a, b) => b.confidence - a.confidence)[0];

  const lc = [...best.largeCancelled].sort((a, b) => a.placed - b.placed);
  const wStart = lc[0]?.placed ?? s.start;
  const wEnd = lc.at(-1)?.end ?? s.end;
  const subjectTrades = new Set(s.trades.filter((t) => t.buyer === best.account || t.seller === best.account).map((t) => t.id));

  const timeline: TimelineEvent[] = [];
  if (lc[0]) {
    const o = lc[0];
    timeline.push({ ts: o.placed, kind: "order", label: `First large ${o.side} placed`, detail: `${fmtCompact(o.size)} ${s.base} @ ${o.price.toPrecision(5)} (${(o.size / venueMedian).toFixed(1)}× median)`, ref: o.id });
    const f = best.oppFills.find((x) => x.end >= o.placed && x.end <= o.end);
    if (f) timeline.push({ ts: f.end, kind: "trade", label: `Opposite ${f.side} filled`, detail: `${fmtCompact(f.size)} ${s.base} executed while large ${o.side} rested`, ref: f.id });
    timeline.push({ ts: o.end, kind: "order", label: `Large ${o.side} cancelled`, detail: `After ${fmtNum(o.end - o.placed)} ms, unfilled`, ref: o.id });
  }
  if (lc.length > 2) {
    const mid = lc[Math.floor(lc.length / 2)];
    timeline.push({ ts: mid.placed, kind: "order", label: "Pattern repeats", detail: `${lc.length} large cancelled orders across the window; ${best.oppFills.length} opposite-side fills`, ref: mid.id });
  }
  if (lc.at(-1)) timeline.push({ ts: lc.at(-1)!.end, kind: "order", label: "Last large order cancelled", detail: "No further layering activity observed", ref: lc.at(-1)!.id });
  timeline.push({ ts: s.end + 9 * 60_000, kind: "detection", label: "Detection generated", detail: `${DETECTOR_VERSIONS.spoofing} scored ${best.confidence}/100` });

  const metrics: Metric[] = [
    { label: "Orders placed", value: fmtNum(best.os.length), hint: `${best.cancelled.length} cancelled · ${best.filled.length} filled` },
    { label: "Cancel-to-fill", value: `${best.ctf.toFixed(1)} : 1` },
    { label: "Large orders", value: fmtNum(best.large.length), hint: `≥${cfg.spoof.sizeMultiple}× venue median` },
    { label: "Median life (large, cancelled)", value: best.largeCancelled.length ? `${fmtNum(best.life)} ms` : "—" },
    { label: "Opposite-side fills while resting", value: pct(best.oppFrac), hint: `${best.oppFills.length} of ${best.filled.length} fills` },
    { label: "Layering side", value: best.largeCancelled.length ? (best.dominantSide === "ask" ? "Ask (sell) side" : "Bid (buy) side") : "—" },
  ];

  return {
    id: s.id, caseRef: s.caseRef, pattern: "spoofing", confidence: best.confidence,
    suppressed: best.confidence < cfg.minConfidence,
    window: { start: wStart, end: wEnd }, venue: s.venue, pair: s.pair,
    wallets: [best.account], clusters: [{ id: "A1", wallets: [best.account], basis: "Single venue account" }], metrics,
    raw: { placed: best.os.length, cancelled: best.cancelled.length, filled: best.filled.length, ctf: best.ctf, life: best.life, largeShare: best.largeShare, oppFrac: best.oppFrac, largeCount: best.large.length, oppFills: best.oppFills.length, askSide: best.dominantSide === "ask" ? 1 : 0, venueMedian },
    factors: best.factors,
    limitations: [
      ...best.lim,
      "Order-level data reflects the venue's public feed; account attribution assumes the venue's private order log matches.",
      "Book depth at the time of each order has been approximated from the median order size, not a full depth snapshot.",
      s.labels[best.account] ? `Account is labelled "${s.labels[best.account]}" — quoting obligations may explain cancellations.` : "Market-making agreements with the venue have not been checked.",
    ],
    timeline: timeline.sort((a, b) => a.ts - b.ts),
    series: buildSeries(s, 5 * 60_000, (t) => subjectTrades.has(t.id)),
    graph: buildGraph(s, [best.account], []),
    evidence: [
      ...lc.slice(0, 24).map((o) => ({ ts: o.placed, ref: o.id, type: `order (${o.side})`, from: best.account, to: s.venue.name, price: o.price, size: o.size, note: `Cancelled after ${fmtNum(o.end - o.placed)} ms` })),
      ...best.oppFills.slice(0, 16).map((f) => ({ ts: f.end, ref: f.id, type: `fill (${f.side})`, from: best.account, to: s.venue.name, price: f.price, size: f.size, note: "Opposite side while large order resting" })),
    ].sort((a, b) => a.ts - b.ts),
    detectorVersion: DETECTOR_VERSIONS.spoofing,
    summary: best.largeCancelled.length
      ? `Account placed ${best.large.length} large ${best.dominantSide === "ask" ? "asks" : "bids"} cancelled after a median ${fmtNum(best.life)} ms, while ${pct(best.oppFrac, 0)} of its fills executed on the other side.`
      : `High-frequency quoting with ${best.ctf.toFixed(0)}:1 cancel ratio but no large orders or directional fills.`,
    defaultStatus: s.defaultStatus, assignee: s.assignee,
  };
}

/* ================================================================ COORDINATED PUMP */
export function detectPump(s: Scenario, cfg: DetectionSettings): Detection {
  const binMs = 60_000;
  const series = buildSeries(s, binMs, () => false);
  const baseline = series.slice(0, 60).map((p) => p.volume);
  const mu = sum(baseline) / Math.max(1, baseline.length);
  const sd = Math.sqrt(sum(baseline.map((v) => (v - mu) ** 2)) / Math.max(1, baseline.length)) || 1;
  const z = series.map((p) => (p.volume - mu) / sd);
  let peak = 0;
  z.forEach((v, i) => { if (v > z[peak]) peak = i; });
  let a = peak, b = peak;
  while (a > 0 && z[a - 1] >= cfg.pump.zThreshold / 2) a--;
  while (b < z.length - 1 && z[b + 1] >= cfg.pump.zThreshold / 2) b++;
  const wStart = series[a].t;
  const wEnd = series[b].t + binMs;
  const open = series[Math.max(0, a - 1)].price;
  const maxPrice = Math.max(...series.slice(a, Math.min(series.length, b + 10)).map((p) => p.price));
  const priceChange = open ? maxPrice / open - 1 : 0;

  const inWin = s.trades.filter((t) => t.ts >= wStart && t.ts < wEnd);
  const buys = new Map<string, number>();
  inWin.forEach((t) => { if (t.buyer !== s.pool) buys.set(t.buyer, (buys.get(t.buyer) ?? 0) + t.size); });
  const totalBuy = sum([...buys.values()]);
  const top = [...buys.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10);
  const topShare = totalBuy ? sum(top.map(([, v]) => v)) / totalBuy : 0;

  const clusters = fundingClusters(s);
  const topSet = new Set(top.map(([w]) => w));
  const bestCluster = clusters.map((c) => ({ c, n: c.wallets.filter((w) => topSet.has(w)).length })).sort((x, y) => y.n - x.n)[0];
  const fundingFrac = bestCluster ? bestCluster.n / Math.max(1, top.length) : 0;
  const cohort = bestCluster && bestCluster.n >= 2 ? bestCluster.c.wallets : top.slice(0, 5).map(([w]) => w);
  const cohortSet = new Set(cohort);

  const lookback = cfg.pump.socialLookbackMin * 60_000;
  const social = s.social.filter((p) => p.ts >= wStart - lookback && p.ts <= wStart + 5 * 60_000);
  const bought = sum(inWin.filter((t) => cohortSet.has(t.buyer)).map((t) => t.size));
  const sold = sum(s.trades.filter((t) => cohortSet.has(t.seller) && t.ts >= wEnd && t.ts <= wEnd + cfg.pump.dumpLookaheadMin * 60_000).map((t) => t.size));
  const dumpRatio = bought ? sold / bought : 0;

  const factors = [
    factor("z", "Abnormal volume (z-score)", 15, z[peak] / (cfg.pump.zThreshold * 2), `z = ${z[peak].toFixed(1)}`, `Peak 1-minute volume against the preceding 60-minute baseline. Full weight at z ≥ ${cfg.pump.zThreshold * 2}.`),
    factor("price", "Price dislocation", 10, priceChange / 0.3, pct(priceChange), "Maximum price rise from the pre-spike close. Full weight at ≥30%."),
    factor("conc", "Buy-side concentration", 20, (topShare - 0.3) / 0.5, pct(topShare), "Share of in-window buy volume from the top 10 wallets. Organic rallies tend to be broad-based; full weight at ≥80%."),
    factor("funding", "Shared funding among top buyers", 20, fundingFrac / 0.6, bestCluster ? `${bestCluster.n} of ${top.length} top buyers` : "None", "Top buyers funded from a common non-service address before the spike suggests coordination."),
    factor("social", "Promotional signal preceding spike", 10, social.length ? 1 : 0, social.length ? `${social.length} post(s), reach ${fmtCompact(sum(social.map((p) => p.reach)))}` : "None found", `Public promotion within ${cfg.pump.socialLookbackMin} minutes before the spike. Absence does not rule out private coordination.`),
    factor("dump", "Rapid exit by the same wallets", 25, dumpRatio / 0.7, pct(dumpRatio), `Share of the cohort's spike purchases sold within ${cfg.pump.dumpLookaheadMin} minutes after the window. Full weight at ≥70%.`),
  ];
  const confidence = Math.round(sum(factors.map((f) => f.score)));

  const timeline: TimelineEvent[] = [
    ...s.funding.filter((f) => cohortSet.has(f.to)).map((f) => ({ ts: f.ts, kind: "funding" as const, label: "Cohort wallet funded", detail: `${fmtNum(f.amount, 2)} ${f.asset} from ${shortAddr(f.from)} → ${shortAddr(f.to)}`, ref: f.ref })),
    ...social.map((p) => ({ ts: p.ts, kind: "social" as const, label: `${p.channel} post by ${p.handle}`, detail: `“${p.text}” (reach ${fmtCompact(p.reach)})` })),
    { ts: wStart, kind: "price", label: "Volume spike begins", detail: `Volume z-score crosses ${(cfg.pump.zThreshold / 2).toFixed(1)}` },
    { ts: series[peak].t, kind: "price", label: "Peak volume minute", detail: `z = ${z[peak].toFixed(1)}; price +${pct(priceChange)}` },
  ];
  const dumps = s.trades.filter((t) => cohortSet.has(t.seller) && t.ts >= wEnd).sort((x, y) => x.ts - y.ts);
  if (dumps[0]) timeline.push({ ts: dumps[0].ts, kind: "trade", label: "Cohort begins selling", detail: `${shortAddr(dumps[0].seller)} sells ${fmtCompact(dumps[0].size)} ${s.base}`, ref: dumps[0].ref });
  if (dumps.length > 1) timeline.push({ ts: dumps.at(-1)!.ts, kind: "trade", label: "Cohort exit complete", detail: `${pct(dumpRatio, 0)} of spike purchases sold`, ref: dumps.at(-1)!.ref });
  timeline.push({ ts: s.end + 6 * 60_000, kind: "detection", label: "Detection generated", detail: `${DETECTOR_VERSIONS.coordinated_pump} scored ${confidence}/100` });

  const flagged = (t: Trade) => cohortSet.has(t.buyer) || cohortSet.has(t.seller);
  const clusterList: Cluster[] = bestCluster && bestCluster.n >= 2 ? [bestCluster.c] : [{ id: "T1", wallets: cohort, basis: "Top buyers in spike window (no funding link)" }];

  return {
    id: s.id, caseRef: s.caseRef, pattern: "coordinated_pump", confidence,
    suppressed: confidence < cfg.minConfidence,
    window: { start: wStart, end: wEnd }, venue: s.venue, pair: s.pair,
    wallets: cohort, clusters: clusterList,
    metrics: [
      { label: "Peak volume z-score", value: z[peak].toFixed(1) },
      { label: "Price change", value: `+${pct(priceChange)}` },
      { label: "Top-10 buyer share", value: pct(topShare) },
      { label: "Cohort size", value: `${cohort.length} wallets`, hint: bestCluster ? `${bestCluster.n} share a funder` : undefined },
      { label: "Cohort exit ratio", value: pct(dumpRatio), hint: `within ${cfg.pump.dumpLookaheadMin} min` },
      { label: "Social signals", value: String(social.length) },
    ],
    raw: { z: z[peak], priceChange, topShare, fundingFrac, social: social.length, dumpRatio, cohort: cohort.length, windowMin: (wEnd - wStart) / 60_000 },
    factors,
    limitations: [
      "Social signals are limited to monitored public channels; private group coordination is not observable.",
      "Retail buying in response to promotion inflates volume; concentration measures may understate cohort share.",
      bestCluster && bestCluster.n >= 2 ? "Funding linkage is on-chain only; wallets could be controlled by unrelated persons using a common service." : "Top buyers have no common funding source — coordination is not evidenced on-chain.",
      "No information on whether the token issuer or project team was involved.",
    ],
    timeline: timeline.sort((x, y) => x.ts - y.ts),
    series: buildSeries(s, 5 * 60_000, flagged),
    graph: buildGraph(s, cohort, clusterList),
    evidence: [
      ...inWin.filter((t) => cohortSet.has(t.buyer)).slice(0, 20).map((t) => tradeRecord(t, "Cohort buy during spike")),
      ...dumps.slice(0, 16).map((t) => tradeRecord(t, "Cohort sell after spike")),
    ],
    detectorVersion: DETECTOR_VERSIONS.coordinated_pump,
    summary: `${cohort.length} wallets drove ${pct(topShare, 0)} of buy volume in a ${Math.round((wEnd - wStart) / 60_000)}-minute spike (+${pct(priceChange, 0)}), then sold ${pct(dumpRatio, 0)} of their position.`,
    defaultStatus: s.defaultStatus, assignee: s.assignee,
  };
}

/** Rule-based evidence never establishes certainty, so published scores are capped. */
export const CONFIDENCE_CAP = 97;

export function runDetector(s: Scenario, cfg: DetectionSettings): Detection {
  const d = s.detector === "wash_trading" ? detectWash(s, cfg) : s.detector === "spoofing" ? detectSpoof(s, cfg) : detectPump(s, cfg);
  const confidence = Math.min(CONFIDENCE_CAP, d.confidence);
  return { ...d, confidence, suppressed: confidence < cfg.minConfidence };
}

export function confidenceBand(c: number): "critical" | "high" | "moderate" | "low" {
  if (c >= 85) return "critical";
  if (c >= 70) return "high";
  if (c >= 50) return "moderate";
  return "low";
}

export { fmtTs };
