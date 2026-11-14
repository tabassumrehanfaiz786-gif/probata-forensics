/**
 * Sample replay dataset. Each scenario is a deterministic, seeded reconstruction of venue data
 * (trades, order events, funding transfers, social posts). Detectors never read the "plan" used
 * to generate a scenario — they only see the raw records, exactly as they would with live feeds.
 */
import { b58, between, gauss, hex, int, logn, mulberry32, pick, type Rng } from "./prng";
import type { CaseStatus, FundingEdge, OrderEvent, PatternType, Scenario, SocialSignal, Trade, Venue } from "./types";

const MIN = 60_000;
const DAY = 86_400_000;
const at = (d: number, h: number, m = 0) => Date.UTC(2026, 10, d, h, m, 0);

const VENUES: Record<string, Venue> = {
  binance: { id: "binance", name: "Binance", kind: "CEX", source: "Binance spot WebSocket (trades + depth)" },
  kraken: { id: "kraken", name: "Kraken", kind: "CEX", source: "Kraken WebSocket v2 (trade + book)" },
  coinbase: { id: "coinbase", name: "Coinbase Exchange", kind: "CEX", source: "Coinbase Advanced Trade WS" },
  uniEth: { id: "uniswap-v3-eth", name: "Uniswap v3", kind: "DEX", chain: "Ethereum", source: "Ethereum archive node (Swap logs)" },
  uniBase: { id: "uniswap-v3-base", name: "Uniswap v3", kind: "DEX", chain: "Base", source: "Base RPC (Swap logs)" },
  raydium: { id: "raydium", name: "Raydium CLMM", kind: "DEX", chain: "Solana", source: "Solana RPC (program logs)" },
};

const evmAddr = (r: Rng) => "0x" + hex(r, 40);
const solAddr = (r: Rng) => b58(r, 44);
const acct = (r: Rng) => "acct-" + hex(r, 6).toUpperCase();
const evmTx = (r: Rng) => "0x" + hex(r, 64);
const solTx = (r: Rng) => b58(r, 87);

interface Intent {
  ts: number;
  buyer: string;
  seller: string;
  size: number;
  /** log-price impact applied before this fill */
  impact: number;
}

function priceIntents(r: Rng, intents: Intent[], p0: number, noise: number, ref: (r: Rng, i: number) => string): Trade[] {
  intents.sort((a, b) => a.ts - b.ts);
  let p = p0;
  return intents.map((it, i) => {
    p = p * Math.exp(noise * gauss(r) + it.impact);
    return { id: `t${i}`, ts: it.ts, buyer: it.buyer, seller: it.seller, price: p, size: it.size, ref: ref(r, i) };
  });
}

function organic(
  r: Rng,
  o: { start: number; end: number; n: number; wallets: string[]; pool?: string; median: number; sigma: number; depth: number; buyBias?: number },
): Intent[] {
  const out: Intent[] = [];
  for (let i = 0; i < o.n; i++) {
    const ts = Math.floor(between(r, o.start, o.end));
    const size = logn(r, o.median, o.sigma);
    const isBuy = r() < (o.buyBias ?? 0.5);
    const w = pick(r, o.wallets);
    let cp = o.pool ?? pick(r, o.wallets);
    while (cp === w) cp = pick(r, o.wallets);
    out.push({
      ts,
      buyer: isBuy ? w : cp,
      seller: isBuy ? cp : w,
      size,
      impact: ((isBuy ? 1 : -1) * size) / o.depth,
    });
  }
  return out;
}

function fundingFan(r: Rng, from: string, to: string[], when: number, asset: string, amount: [number, number], tx: (r: Rng) => string): FundingEdge[] {
  return to.map((w, i) => ({
    from,
    to: w,
    amount: Number(between(r, amount[0], amount[1]).toFixed(3)),
    asset,
    ts: when + i * int(r, 4, 40) * MIN,
    ref: tx(r),
  }));
}

function base(id: string, caseRef: string, detector: PatternType, pair: string, venue: Venue, start: number, end: number, status: CaseStatus, assignee: string): Scenario {
  const [b, q] = pair.split("/");
  return { id, caseRef, detector, pair, base: b, quote: q, venue, start, end, trades: [], orders: [], funding: [], social: [], services: [], labels: {}, defaultStatus: status, assignee };
}

/* ---------------------------------------------------------------- wash: CEX self-crossing */
function washCex(seed: number, o: {
  id: string; caseRef: string; pair: string; venue: Venue; day: number; hour: number; status: CaseStatus; assignee: string;
  cluster: number; washPairs: number; organicN: number; p0: number; crossShare: number; lots: number[];
}): Scenario {
  const r = mulberry32(seed);
  const start = at(o.day, o.hour);
  const end = start + 180 * MIN;
  const s = base(o.id, o.caseRef, "wash_trading", o.pair, o.venue, start, end, o.status, o.assignee);
  const accounts = Array.from({ length: 90 }, () => acct(r));
  const subjects = Array.from({ length: o.cluster }, () => acct(r));
  const funder = evmAddr(r);
  const hot = evmAddr(r);
  s.services = [hot];
  s.labels[hot] = `${o.venue.name} hot wallet`;
  s.labels[funder] = "Common funding address";
  s.funding = [
    ...fundingFan(r, funder, subjects, start - 2 * DAY, "USDT", [40_000, 90_000], evmTx),
    ...fundingFan(r, hot, accounts.slice(0, 12), start - 3 * DAY, "USDT", [500, 8000], evmTx),
  ];
  const intents = organic(r, { start, end, n: o.organicN, wallets: accounts, median: 1800, sigma: 1.0, depth: 4_000_000 });
  for (let i = 0; i < o.washPairs; i++) {
    const ts = Math.floor(between(r, start + 10 * MIN, end - 20 * MIN));
    const lot = pick(r, o.lots) * (1 + 0.003 * gauss(r));
    const a = pick(r, subjects);
    let b = pick(r, subjects);
    if (subjects.length > 1) while (b === a) b = pick(r, subjects);
    if (r() < o.crossShare) {
      intents.push({ ts, buyer: a, seller: b, size: lot, impact: 0 });
    } else {
      const cp1 = pick(r, accounts);
      const cp2 = pick(r, accounts);
      const lag = int(r, 6, 42) * 1000;
      intents.push({ ts, buyer: a, seller: cp1, size: lot, impact: lot / 4_000_000 });
      intents.push({ ts: ts + lag, buyer: cp2, seller: b, size: lot * (1 + 0.006 * gauss(r)), impact: -lot / 4_000_000 });
    }
  }
  s.trades = priceIntents(r, intents, o.p0, 0.0009, (rr) => `${o.venue.id.toUpperCase()}-${int(rr, 1e9, 9e9)}`);
  return s;
}

/* ---------------------------------------------------------------- wash: DEX round trips */
function washDex(seed: number): Scenario {
  const r = mulberry32(seed);
  const start = at(9, 13);
  const end = start + 180 * MIN;
  const s = base("sc-koru", "EF-2026-0151", "wash_trading", "KORU/WETH", VENUES.uniEth, start, end, "new", "Unassigned");
  const pool = evmAddr(r);
  s.pool = pool;
  s.labels[pool] = "KORU/WETH 0.3% pool";
  const wallets = Array.from({ length: 140 }, () => evmAddr(r));
  const subjects = Array.from({ length: 4 }, () => evmAddr(r));
  const funder = evmAddr(r);
  const bridge = evmAddr(r);
  s.services = [bridge];
  s.labels[bridge] = "Canonical bridge (service)";
  s.labels[funder] = "Common funding address";
  s.funding = [
    ...fundingFan(r, funder, subjects, start - 1 * DAY, "ETH", [6, 14], evmTx),
    ...fundingFan(r, bridge, wallets.slice(0, 20), start - 4 * DAY, "ETH", [0.2, 3], evmTx),
  ];
  const depth = 9_000_000;
  const intents = organic(r, { start, end, n: 620, wallets, pool, median: 22_000, sigma: 1.1, depth });
  for (let i = 0; i < 58; i++) {
    const ts = Math.floor(between(r, start + 5 * MIN, end - 15 * MIN));
    const w = pick(r, subjects);
    const w2 = r() < 0.6 ? w : pick(r, subjects);
    const lot = pick(r, [150_000, 200_000, 250_000]) * (1 + 0.004 * gauss(r));
    const lag = int(r, 12, 50) * 1000;
    intents.push({ ts, buyer: w, seller: pool, size: lot, impact: lot / depth });
    intents.push({ ts: ts + lag, buyer: pool, seller: w2, size: lot * (1 + 0.005 * gauss(r)), impact: -lot / depth });
  }
  s.trades = priceIntents(r, intents, 0.000213, 0.0012, (rr) => evmTx(rr));
  return s;
}

/* ---------------------------------------------------------------- benign market maker */
function benignMaker(seed: number): Scenario {
  const r = mulberry32(seed);
  const start = at(11, 8);
  const end = start + 180 * MIN;
  const s = base("sc-qrtz", "EF-2026-0153", "wash_trading", "QRTZ/USDT", VENUES.coinbase, start, end, "new", "Unassigned");
  const accounts = Array.from({ length: 90 }, () => acct(r));
  const mm = acct(r);
  s.labels[mm] = "Registered liquidity provider";
  const intents = organic(r, { start, end, n: 900, wallets: accounts, median: 1500, sigma: 1.0, depth: 6_000_000 });
  for (let i = 0; i < 420; i++) {
    const ts = Math.floor(between(r, start, end));
    const size = logn(r, 2600, 0.7);
    const cp = pick(r, accounts);
    const buy = r() < 0.5;
    intents.push({ ts, buyer: buy ? mm : cp, seller: buy ? cp : mm, size, impact: 0 });
  }
  s.trades = priceIntents(r, intents, 1.284, 0.0006, (rr) => `CB-${hex(rr, 8)}-${hex(rr, 4)}`);
  return s;
}

/* ---------------------------------------------------------------- spoofing */
function spoof(seed: number, o: {
  id: string; caseRef: string; pair: string; venue: Venue; day: number; hour: number; status: CaseStatus; assignee: string;
  spoofSide: "ask" | "bid"; cycles: number; p0: number; spoofMult: [number, number]; lifeMs: [number, number]; benign?: boolean;
}): Scenario {
  const r = mulberry32(seed);
  const start = at(o.day, o.hour);
  const dur = 90 * MIN;
  const end = start + dur;
  const s = base(o.id, o.caseRef, "spoofing", o.pair, o.venue, start, end, o.status, o.assignee);
  const mms = Array.from({ length: 24 }, () => acct(r));
  const takers = Array.from({ length: 70 }, () => acct(r));
  const subject = acct(r);
  if (o.benign) s.labels[subject] = "Designated market maker (venue programme)";

  // mid-price path at 1s resolution
  const secs = dur / 1000;
  const mid: number[] = new Array(secs + 1);
  mid[0] = o.p0;
  for (let i = 1; i <= secs; i++) mid[i] = mid[i - 1] * Math.exp(0.00025 * gauss(r));
  const midAt = (ts: number) => mid[Math.max(0, Math.min(secs, Math.floor((ts - start) / 1000)))];

  const orders: OrderEvent[] = [];
  let oid = 0;
  const medianSize = 900;
  const push = (account: string, side: "bid" | "ask", ts: number, price: number, size: number, terminal: "cancel" | "fill", life: number) => {
    const id = `o${++oid}`;
    orders.push({ id: `${id}p`, orderId: id, ts, account, side, price, size, action: "place" });
    orders.push({ id: `${id}${terminal[0]}`, orderId: id, ts: ts + life, account, side, price, size, action: terminal });
  };
  // organic resting liquidity
  for (let i = 0; i < 2600; i++) {
    const ts = Math.floor(between(r, start, end - 30_000));
    const side = r() < 0.5 ? "bid" : "ask";
    const m = midAt(ts);
    const price = m * (1 + (side === "ask" ? 1 : -1) * between(r, 0.0002, 0.004));
    const fill = r() < 0.32;
    push(pick(r, mms), side, ts, price, logn(r, medianSize, 0.6), fill ? "fill" : "cancel", int(r, 400, 25_000));
  }
  if (o.benign) {
    // high-frequency quoting: symmetric, small, many cancels, no directional fills
    for (let i = 0; i < 900; i++) {
      const ts = Math.floor(between(r, start, end - 10_000));
      const side = r() < 0.5 ? "bid" : "ask";
      const m = midAt(ts);
      push(subject, side, ts, m * (1 + (side === "ask" ? 1 : -1) * 0.0004), logn(r, medianSize * 0.8, 0.3), r() < 0.06 ? "fill" : "cancel", int(r, 150, 1400));
    }
  } else {
    const opp: "bid" | "ask" = o.spoofSide === "ask" ? "bid" : "ask";
    for (let c = 0; c < o.cycles; c++) {
      const ts = Math.floor(between(r, start + 2 * MIN, end - 2 * MIN));
      const m = midAt(ts);
      const layers = int(r, 2, 5);
      const flickers = int(r, 2, 4);
      const life = int(r, o.lifeMs[0], o.lifeMs[1]);
      // layered orders are placed, pulled and re-placed ("flickering") several times per cycle
      for (let f = 0; f < flickers; f++) {
        const t0 = ts + f * (life + int(r, 40, 400));
        for (let l = 0; l < layers; l++) {
          const px = m * (1 + (o.spoofSide === "ask" ? 1 : -1) * (0.0012 + l * 0.0008));
          push(subject, o.spoofSide, t0 + l * 40, px, medianSize * between(r, o.spoofMult[0], o.spoofMult[1]), "cancel", life);
        }
      }
      if (r() < 0.7) {
        const fts = ts + Math.floor(life * between(r, 0.3, 0.85));
        push(subject, opp, ts + 60, m * (1 + (opp === "ask" ? 1 : -1) * 0.0003), logn(r, medianSize * 1.3, 0.3), "fill", fts - ts - 60);
      }
    }
    for (let i = 0; i < 6; i++) {
      const ts = Math.floor(between(r, start, end - 30_000));
      push(subject, "bid", ts, midAt(ts) * 0.999, logn(r, medianSize, 0.4), "fill", int(r, 2000, 20_000));
    }
  }
  orders.sort((a, b) => a.ts - b.ts);
  s.orders = orders;
  // executed trades from fills
  const trades: Trade[] = [];
  for (const ev of orders) {
    if (ev.action !== "fill") continue;
    const cp = pick(r, takers);
    trades.push({
      id: `t${trades.length}`,
      ts: ev.ts,
      buyer: ev.side === "bid" ? ev.account : cp,
      seller: ev.side === "ask" ? ev.account : cp,
      price: midAt(ev.ts) * (1 + 0.0002 * gauss(r)),
      size: ev.size,
      ref: `${o.venue.id.toUpperCase()}-${int(r, 1e9, 9e9)}`,
    });
  }
  s.trades = trades;
  return s;
}

/* ---------------------------------------------------------------- coordinated pump */
function pump(seed: number, o: {
  id: string; caseRef: string; pair: string; venue: Venue; day: number; hour: number; status: CaseStatus; assignee: string;
  sol?: boolean; cohort: number; buysEach: [number, number]; lot: number; dumpShare: number; social?: SocialSignal[] | "auto"; fomo: number; organicSpread: number;
}): Scenario {
  const r = mulberry32(seed);
  const start = at(o.day, o.hour);
  const end = start + 240 * MIN;
  const s = base(o.id, o.caseRef, "coordinated_pump", o.pair, o.venue, start, end, o.status, o.assignee);
  const mk = o.sol ? solAddr : evmAddr;
  const tx = o.sol ? solTx : evmTx;
  const pool = mk(r);
  s.pool = pool;
  s.labels[pool] = `${o.pair} pool`;
  const wallets = Array.from({ length: 160 }, () => mk(r));
  const cohort = Array.from({ length: o.cohort }, () => mk(r));
  const funder = mk(r);
  s.labels[funder] = "Common funding address";
  const fundedCount = Math.max(2, Math.round(o.cohort * o.organicSpread));
  s.funding = fundingFan(r, funder, cohort.slice(0, fundedCount), start - 2 * DAY, o.sol ? "SOL" : "ETH", o.sol ? [120, 300] : [3, 9], tx);
  const depth = 3_000_000;
  const spikeStart = start + 95 * MIN;
  const intents = organic(r, { start, end, n: 260, wallets, pool, median: 9000, sigma: 1.0, depth });
  for (const w of cohort) {
    const n = int(r, o.buysEach[0], o.buysEach[1]);
    let bought = 0;
    for (let i = 0; i < n; i++) {
      const size = o.lot * between(r, 0.6, 1.4);
      bought += size;
      intents.push({ ts: spikeStart + Math.floor(between(r, 0, 12 * MIN)), buyer: w, seller: pool, size, impact: size / depth });
    }
    const sellTotal = bought * o.dumpShare * between(r, 0.85, 1.1);
    const chunks = int(r, 2, 5);
    for (let i = 0; i < chunks; i++) {
      const size = sellTotal / chunks;
      intents.push({ ts: spikeStart + 26 * MIN + Math.floor(between(r, 0, 28 * MIN)), buyer: pool, seller: w, size, impact: -size / depth });
    }
  }
  // FOMO retail buys during the spike
  for (let i = 0; i < o.fomo; i++) {
    const size = logn(r, 7000, 0.8);
    intents.push({ ts: spikeStart + Math.floor(between(r, 3 * MIN, 20 * MIN)), buyer: pick(r, wallets), seller: pool, size, impact: size / depth });
  }
  s.trades = priceIntents(r, intents, o.sol ? 0.00412 : 0.0000381, 0.002, (rr) => tx(rr));
  if (o.social === "auto") {
    s.social = [
      { ts: spikeStart - 4 * MIN, channel: "Telegram", handle: "@alpha_calls_vip", text: `${o.pair.split("/")[0]} tier-1 exchange listing CONFIRMED — loading now, don't miss this 🚀`, reach: 48_200 },
      { ts: spikeStart + 2 * MIN, channel: "X", handle: "@0xmoonrunner", text: `$${o.pair.split("/")[0]} breaking out. Listing news imminent. NFA.`, reach: 21_400 },
    ];
  } else if (o.social) s.social = o.social;
  return s;
}

let cache: Scenario[] | null = null;

export function getScenarios(): Scenario[] {
  if (cache) return cache;
  cache = [
    washCex(1147, { id: "sc-vlta", caseRef: "EF-2026-0147", pair: "VLTA/USDT", venue: VENUES.binance, day: 7, hour: 9, status: "under_review", assignee: "R. Okafor", cluster: 3, washPairs: 74, organicN: 1100, p0: 0.0842, crossShare: 0.72, lots: [5000, 7500, 10000, 12500] }),
    washDex(1151),
    washCex(1139, { id: "sc-nimb", caseRef: "EF-2026-0139", pair: "NIMB/USDC", venue: VENUES.kraken, day: 3, hour: 15, status: "escalated", assignee: "S. Lindqvist", cluster: 2, washPairs: 34, organicN: 1400, p0: 2.413, crossShare: 0.5, lots: [400, 600, 800] }),
    spoof(1149, { id: "sc-arcx", caseRef: "EF-2026-0149", pair: "ARCX/USDT", venue: VENUES.binance, day: 8, hour: 14, status: "new", assignee: "Unassigned", spoofSide: "ask", cycles: 48, p0: 0.6215, spoofMult: [8, 15], lifeMs: [350, 2200] }),
    spoof(1144, { id: "sc-lumo", caseRef: "EF-2026-0144", pair: "LUMO/EUR", venue: VENUES.kraken, day: 5, hour: 10, status: "under_review", assignee: "R. Okafor", spoofSide: "bid", cycles: 30, p0: 3.871, spoofMult: [5, 9], lifeMs: [900, 2900] }),
    pump(1152, { id: "sc-zeph", caseRef: "EF-2026-0152", pair: "ZEPH/WETH", venue: VENUES.uniBase, day: 12, hour: 16, status: "new", assignee: "Unassigned", cohort: 7, buysEach: [6, 10], lot: 60_000, dumpShare: 0.82, social: "auto", fomo: 140, organicSpread: 1 }),
    pump(1136, { id: "sc-moth", caseRef: "EF-2026-0136", pair: "MOTH/SOL", venue: VENUES.raydium, day: 2, hour: 19, status: "dismissed", assignee: "S. Lindqvist", sol: true, cohort: 9, buysEach: [3, 6], lot: 30_000, dumpShare: 0.45, fomo: 90, organicSpread: 0.45 }),
    benignMaker(1153),
    spoof(1154, { id: "sc-fenx", caseRef: "EF-2026-0154", pair: "FENX/USDT", venue: VENUES.binance, day: 13, hour: 7, status: "new", assignee: "Unassigned", spoofSide: "ask", cycles: 0, p0: 0.0914, spoofMult: [1, 1], lifeMs: [100, 100], benign: true }),
  ];
  return cache;
}

export const ALL_VENUES = Object.values(VENUES);
