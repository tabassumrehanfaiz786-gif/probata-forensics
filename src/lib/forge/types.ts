export type PatternType = "wash_trading" | "spoofing" | "coordinated_pump";
export type CaseStatus = "new" | "under_review" | "escalated" | "dismissed";
export type Role = "analyst" | "compliance" | "admin";
export type VenueKind = "CEX" | "DEX";

export interface Venue {
  id: string;
  name: string;
  kind: VenueKind;
  chain?: string;
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
  pool?: string;
  /** Known service addresses (exchange hot wallets, bridges) excluded from clustering. */
  services: string[];
  labels: Record<string, string>;
  defaultStatus: CaseStatus;
  assignee: string;
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
  funder?: string;
  basis: string;
}

export interface TimelineEvent {
  ts: number;
  kind: "trade" | "order" | "funding" | "social" | "detection" | "price";
  label: string;
  detail: string;
  ref?: string;
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
  clusterId?: string;
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
  label?: string;
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
  price?: number;
  size?: number;
  note: string;
}

export interface Metric {
  label: string;
  value: string;
  hint?: string;
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
  raw: Record<string, number>;
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
}
