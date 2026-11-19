export type PatternType = "wash_trading" | "spoofing" | "coordinated_pump";
export type CaseStatus = "new" | "under_review" | "escalated" | "dismissed";
export type Role = "analyst" | "compliance" | "admin";
export type VenueKind = "CEX" | "DEX";

export interface Venue {
  id: string;
  name: string;
  kind: VenueKind;
  chain?: string | undefined;
  source: string;
}

/** One executed trade. On a DEX the pool address is the counterparty. */
export interface Trade {
  id: string;
  ts: number;
  buyer: string;
  seller: string;
  price: number;
  size: number;
  ref: string;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  ts: number;
  account: string;
  side: "bid" | "ask";
  price: number;
  size: number;
  action: "place" | "cancel" | "fill";
}

export interface FundingEdge {
  from: string;
  to: string;
  amount: number;
  asset: string;
  ts: number;
  ref: string;
}

export interface SocialSignal {
  ts: number;
  channel: string;
  handle: string;
  text: string;
  reach: number;
}

export interface Scenario {
  id: string;
  caseRef: string;
  detector: PatternType;
  pair: string;
  base: string;
  quote: string;
  venue: Venue;
  start: number;
  end: number;
  trades: Trade[];
  orders: OrderEvent[];
  funding: FundingEdge[];
  social: SocialSignal[];
  pool?: string | undefined;
  /** Known service addresses (exchange hot wallets, bridges) excluded from clustering. */
  services: string[];
  labels: Record<string, string>;
  defaultStatus: CaseStatus;
  assignee: string;
  /** Set when the case was promoted from the live public tape. */
  live?: { promotedAt: number; alerts: string[]; tickCount: number } | undefined;
}

export interface ScoreFactor {
  key: string;
  label: string;
  observed: string;
  weight: number;
  score: number;
  rationale: string;
}

export interface Cluster {
  id: string;
  wallets: string[];
  funder?: string | undefined;
  basis: string;
}

export interface TimelineEvent {
  ts: number;
  kind: "trade" | "order" | "funding" | "social" | "detection" | "price";
  label: string;
  detail: string;
  ref?: string | undefined;
}

export interface SeriesPoint {
  t: number;
  price: number;
  volume: number;
  flagged: number;
}

export interface WalletNode {
  id: string;
  role: "subject" | "funder" | "counterparty" | "pool";
  clusterId?: string | undefined;
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
  label?: string | undefined;
}

export interface WalletEdge {
  from: string;
  to: string;
  kind: "funding" | "trade";
  value: number;
  count: number;
}

export interface EvidenceRecord {
  ts: number;
  ref: string;
  type: string;
  from: string;
  to: string;
  price?: number | undefined;
  size?: number | undefined;
  note: string;
}

export interface Metric {
  label: string;
  value: string;
  hint?: string | undefined;
}

export const RAW_KEYS = [
  "pairs", "cross", "roundTrips", "matchedRatio", "netRatio", "venueShare", "clusterSize", "matchedVol", "priceDrift", "linked",
  "placed", "cancelled", "filled", "ctf", "life", "largeShare", "oppFrac", "largeCount", "oppFills", "askSide", "venueMedian",
  "z", "priceChange", "topShare", "fundingFrac", "social", "dumpRatio", "cohort", "windowMin",
] as const;
export type RawKey = (typeof RAW_KEYS)[number];
/** Numeric facts behind a detection; keys a detector does not use are 0. */
export type RawMetrics = Record<RawKey, number>;
export function rawMetrics(partial: Partial<RawMetrics>): RawMetrics {
  const out = {} as RawMetrics;
  for (const k of RAW_KEYS) out[k] = partial[k] ?? 0;
  return out;
}

export interface Detection {
  id: string;
  caseRef: string;
  pattern: PatternType;
  confidence: number;
  suppressed: boolean;
  window: { start: number; end: number };
  venue: Venue;
  pair: string;
  wallets: string[];
  clusters: Cluster[];
  metrics: Metric[];
  raw: RawMetrics;
  factors: ScoreFactor[];
  limitations: string[];
  timeline: TimelineEvent[];
  series: SeriesPoint[];
  graph: { nodes: WalletNode[]; edges: WalletEdge[] };
  evidence: EvidenceRecord[];
  detectorVersion: string;
  summary: string;
  defaultStatus: CaseStatus;
  assignee: string;
}

export interface DetectionSettings {
  minConfidence: number;
  wash: { maxPairSeconds: number; sizeTolerancePct: number; minPairs: number };
  spoof: { sizeMultiple: number; maxLifetimeMs: number; minOrders: number };
  pump: { zThreshold: number; socialLookbackMin: number; dumpLookaheadMin: number };
}

export const DEFAULT_SETTINGS: DetectionSettings = {
  minConfidence: 60,
  wash: { maxPairSeconds: 60, sizeTolerancePct: 2, minPairs: 10 },
  spoof: { sizeMultiple: 5, maxLifetimeMs: 3000, minOrders: 20 },
  pump: { zThreshold: 4, socialLookbackMin: 15, dumpLookaheadMin: 60 },
};

export interface AuditEntry {
  id: string;
  ts: number;
  role: Role;
  action: string;
  target: string;
  detail: string;
  /** Signed-in team member's email, stamped by the database (absent in demo mode). */
  actor?: string | undefined;
}
