/**
 * Detector validation. Two evidence bases, kept separate:
 *  1. Labelled benchmark suite — synthetic cases with known ground truth (confusion matrix, threshold sweep).
 *  2. Historical-event reconstructions — synthetic records parameterised from figures in official
 *     complaints and notices. They are NOT the original tape: no regulator has published the raw
 *     account-level data, so every assumed parameter is listed next to the cited ones.
 */
import { runDetector } from "./detection";
import { getScenarios, pump, spoof, VENUES, washCex } from "./scenarios";
import { DEFAULT_SETTINGS, type DetectionSettings, type PatternType, type Scenario, type Venue } from "./types";

export type Truth = "manipulative" | "benign";

/** Ground truth for the benchmark suite, fixed when each scenario was designed. */
export const BENCHMARK_TRUTH: Record<string, { truth: Truth; basis: string }> = {
  "EF-2026-0147": { truth: "manipulative", basis: "Seeded 3-account wash cluster with common funder" },
  "EF-2026-0151": { truth: "manipulative", basis: "Seeded DEX round-trip wash wallets" },
  "EF-2026-0139": { truth: "manipulative", basis: "Seeded 2-account wash cluster" },
  "EF-2026-0149": { truth: "manipulative", basis: "Seeded 48 spoof cycles on the ask" },
  "EF-2026-0144": { truth: "manipulative", basis: "Seeded 30 spoof cycles on the bid" },
  "EF-2026-0152": { truth: "manipulative", basis: "Seeded funded cohort pump-and-dump with promotion" },
  "EF-2026-0136": { truth: "benign", basis: "Token launch with disclosed partner allocation" },
  "EF-2026-0153": { truth: "benign", basis: "Registered market maker quoting both sides" },
  "EF-2026-0154": { truth: "benign", basis: "No spoof cycles seeded (control)" },
};

export interface Confusion { tp: number; fp: number; tn: number; fn: number; precision: number; recall: number; f1: number; accuracy: number }

export function confusion(rows: { truth: Truth; flagged: boolean }[]): Confusion {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of rows) {
    if (r.flagged && r.truth === "manipulative") tp++;
    else if (r.flagged) fp++;
    else if (r.truth === "manipulative") fn++;
    else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, tn, fn, precision, recall, f1, accuracy: rows.length ? (tp + tn) / rows.length : 0 };
}

export interface ScoredCase { caseRef: string; title: string; pattern: PatternType; truth: Truth; confidence: number; flagged: boolean; topFactors: string[] }

function score(s: Scenario, truth: Truth, title: string, cfg: DetectionSettings): ScoredCase {
  const d = runDetector(s, cfg);
  return {
    caseRef: s.caseRef, title, pattern: d.pattern, truth, confidence: d.confidence, flagged: d.confidence >= cfg.minConfidence,
    topFactors: [...d.factors].sort((a, b) => b.score - a.score).slice(0, 3).map((f) => `${f.label} (${f.observed})`),
  };
}

export function scoreBenchmark(cfg: DetectionSettings = DEFAULT_SETTINGS): ScoredCase[] {
  return getScenarios().map((s) => score(s, BENCHMARK_TRUTH[s.caseRef]?.truth ?? "manipulative", `${s.pair} · ${s.venue.name}`, cfg));
}

export function thresholdSweep(thresholds = [40, 50, 60, 70, 80]) {
  return thresholds.map((t) => ({ threshold: t, ...confusion(scoreBenchmark({ ...DEFAULT_SETTINGS, minConfidence: t })) }));
}

/** Move a generated scenario onto the real event date so timelines read correctly. */
function relocate(s: Scenario, startUtc: number, venue: Venue): Scenario {
  const dt = startUtc - s.start;
  return {
    ...s, venue, start: s.start + dt, end: s.end + dt,
    trades: s.trades.map((t) => ({ ...t, ts: t.ts + dt })),
    orders: s.orders.map((o) => ({ ...o, ts: o.ts + dt })),
    funding: s.funding.map((f) => ({ ...f, ts: f.ts + dt })),
    social: s.social.map((x) => ({ ...x, ts: x.ts + dt })),
  };
}

export interface Param { name: string; value: string; kind: "cited" | "assumed"; source?: string; pin?: string }
export interface Reconstruction {
  id: string; event: string; date: string; legalStatus: string; dossierId: string;
  question: string; params: Param[]; scenario: () => Scenario; expected: Truth; reading: (r: ScoredCase) => string;
}

const CFTC_MANGO = "https://www.cftc.gov/media/8046/enfeisenbergcomplaint010923/download";
const SEC_MANGO = "https://www.sec.gov/files/litigation/complaints/2023/comp-pr2023-13.pdf";
const DOJ_MIRRORS = "https://www.justice.gov/usao-ma/pr/eighteen-individuals-and-entities-charged-international-operation-targeting-widespread";
const FCA_ABBATTISTA = "https://www.fca.org.uk/publication/final-notices/corrado-abbattista-dec-2020.pdf";

const mangoVenue: Venue = { id: "mango-markets", name: "Mango Markets (reconstruction)", kind: "DEX", chain: "Solana", source: "Reconstruction from CFTC & SEC complaints — not original tape" };

export const RECONSTRUCTIONS: Reconstruction[] = [
  {
    id: "mango-perp", dossierId: "mango-markets", event: "Mango Markets — offsetting MNGO-PERP positions", date: "11 Oct 2022",
    legalStatus: "CFTC/SEC civil allegations; SDNY convictions vacated May 2025",
    question: "Does the wash detector link two commonly funded accounts trading against each other?",
    params: [
      { name: "Linked accounts", value: "2", kind: "cited", source: CFTC_MANGO, pin: "¶31" },
      { name: "Funding per account", value: "$5m USDC", kind: "cited", source: CFTC_MANGO, pin: "¶31" },
      { name: "Starting price", value: "≈ $0.04", kind: "cited", source: CFTC_MANGO, pin: "¶31" },
      { name: "Share of position traded account-to-account", value: "90%", kind: "assumed" },
      { name: "Matched fills / lot sizes", value: "60 fills of 5–10m MNGO", kind: "assumed" },
    ],
    scenario: () => relocate(washCex(2210, { id: "rc-mango-perp", caseRef: "RC-2022-MANGO-A", pair: "MNGO-PERP/USDC", venue: mangoVenue, day: 1, hour: 0, status: "new", assignee: "Reconstruction", cluster: 2, washPairs: 60, organicN: 700, p0: 0.04, crossShare: 0.9, lots: [5_000_000, 7_500_000, 10_000_000] }), Date.UTC(2022, 9, 11, 22, 0), mangoVenue),
    expected: "manipulative",
    reading: (r) => r.flagged ? "Detected: matched trades between the two funded accounts score above the alert threshold." : "Missed at the default threshold — review the factor breakdown.",
  },
  {
    id: "mango-spot", dossierId: "mango-markets", event: "Mango Markets — spot buying that moved the oracle", date: "11 Oct 2022",
    legalStatus: "CFTC/SEC civil allegations; SDNY convictions vacated May 2025",
    question: "Does the pump detector catch a price push when value is extracted by borrowing, not by selling?",
    params: [
      { name: "Buying window", value: "< 30 minutes", kind: "cited", source: CFTC_MANGO, pin: "¶¶5–6, 32–38" },
      { name: "Oracle price move", value: "$0.04 → $0.54 (13×)", kind: "cited", source: CFTC_MANGO, pin: "¶¶32–38" },
      { name: "Spot spend on one venue", value: "> $75,000 for > 1m MNGO", kind: "cited", source: CFTC_MANGO, pin: "¶34" },
      { name: "Volume vs 10-day average", value: "> 2,000% higher", kind: "cited", source: SEC_MANGO, pin: "¶4" },
      { name: "Spot sold back after the push", value: "10% (value taken by borrowing)", kind: "assumed" },
      { name: "Buying wallets", value: "2, commonly funded", kind: "assumed" },
      { name: "Buy size per fill", value: "Calibrated so the simulated move (≈ 17×) is in the cited range", kind: "assumed" },
    ],
    scenario: () => relocate(pump(2211, { id: "rc-mango-spot", caseRef: "RC-2022-MANGO-B", pair: "MNGO/USDC", venue: mangoVenue, day: 1, hour: 0, status: "new", assignee: "Reconstruction", sol: true, cohort: 2, buysEach: [12, 18], lot: 260_000, dumpShare: 0.1, fomo: 20, organicSpread: 1 }), Date.UTC(2022, 9, 11, 20, 30), mangoVenue),
    expected: "manipulative",
    reading: (r) => r.flagged ? "Detected despite little selling." : "Known blind spot: the pump detector weights the dump leg, so an oracle push monetised by borrowing scores low. A lending-protocol collateral check is needed.",
  },
  {
    id: "token-mirrors", dossierId: "token-mirrors", event: "Operation Token Mirrors — wash trading for hire", date: "Charged 9 Oct 2024",
    legalStatus: "DOJ charges; Gotbit and founder pleaded guilty (Mar 2025)",
    question: "Does the wash detector flag a market-maker bot cluster self-trading to fake volume?",
    params: [
      { name: "Conduct", value: "Sham / wash trades to create appearance of activity", kind: "cited", source: DOJ_MIRRORS },
      { name: "Tokens affected", value: "≈ 60 (bots disabled)", kind: "cited", source: DOJ_MIRRORS },
      { name: "Bot accounts in cluster", value: "6", kind: "assumed" },
      { name: "Wash fills in 3h window", value: "120", kind: "assumed" },
    ],
    scenario: () => relocate(washCex(2410, { id: "rc-mirrors", caseRef: "RC-2024-MIRRORS", pair: "TOKEN/USDT", venue: VENUES.binance, day: 1, hour: 0, status: "new", assignee: "Reconstruction", cluster: 6, washPairs: 120, organicN: 500, p0: 0.012, crossShare: 0.8, lots: [20_000, 25_000, 50_000] }), Date.UTC(2024, 3, 1, 12, 0), { id: "cex-unnamed", name: "Centralised venue (unnamed)", kind: "CEX", source: "Reconstruction from DOJ D. Mass. release — not original tape" }),
    expected: "manipulative",
    reading: (r) => r.flagged ? "Detected: self-crossed volume and common funding across the bot cluster." : "Missed at the default threshold.",
  },
  {
    id: "abbattista", dossierId: "fca-market-abuse", event: "FCA v Abbattista — large misleading orders", date: "Jan–May 2017 (Final Notice Dec 2020)",
    legalStatus: "FCA Final Notice: £100,000 penalty and prohibition, UK MAR Art. 15",
    question: "Does the spoofing detector flag large orders placed opposite small genuine orders and cancelled?",
    params: [
      { name: "Pattern", value: "Large misleading orders opposite smaller genuine orders", kind: "cited", source: FCA_ABBATTISTA },
      { name: "Market", value: "Equities (not crypto) — used as a method benchmark", kind: "cited", source: FCA_ABBATTISTA },
      { name: "Size multiple of misleading orders", value: "6–12× genuine", kind: "assumed" },
      { name: "Order lifetime before cancel", value: "1–3 s", kind: "assumed" },
      { name: "Cycles in 90 min", value: "25", kind: "assumed" },
    ],
    scenario: () => relocate(spoof(2017, { id: "rc-abbattista", caseRef: "RC-2017-FCA", pair: "EQUITY/GBP", venue: VENUES.kraken, day: 1, hour: 0, status: "new", assignee: "Reconstruction", spoofSide: "ask", cycles: 25, p0: 12.4, spoofMult: [6, 12], lifeMs: [1000, 2900] }), Date.UTC(2017, 2, 14, 9, 0), { id: "lse-reconstruction", name: "UK equity venue (reconstruction)", kind: "CEX", source: "Reconstruction from FCA Final Notice — not original order book" }),
    expected: "manipulative",
    reading: (r) => r.flagged ? "Detected: short-lived large orders on the opposite side to genuine fills." : "Missed at the default threshold.",
  },
];

export function scoreReconstructions(cfg: DetectionSettings = DEFAULT_SETTINGS) {
  return RECONSTRUCTIONS.map((rc) => {
    const r = score(rc.scenario(), rc.expected, rc.event, cfg);
    return { rc, result: r, reading: rc.reading(r) };
  });
}
