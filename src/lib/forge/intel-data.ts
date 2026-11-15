// Browser-safe deterministic data for the global intelligence graph (fictional replay entities).
import { mulberry32 } from "./prng";

export type IntelCategory = "primary" | "coordinator" | "cluster" | "mixer" | "bridge" | "exchange" | "pool" | "wallet";
export type FlowKind = "wash" | "funding" | "exit" | "bridge";

export interface IntelEntity {
  id: string; label: string; subtitle: string; category: IntelCategory; chain: string;
  risk: number; x: number; y: number; amount?: string; note?: string; hub?: string;
}
export interface IntelFlow { id: string; from: string; to: string; kind: FlowKind; value: number; hops: number; label?: string }

export const CHAINS = ["Ethereum", "BNB Chain", "Solana", "Tron", "Arbitrum"] as const;

const HUBS: IntelEntity[] = [
  { id: "syn", label: "Syndicate 0x7a3f…c91e", subtitle: "Primary target · wash ring controller", category: "primary", chain: "Ethereum", risk: 97, x: 0, y: 0, amount: "$14.2M", note: "Controls 41 wallets via common gas funder; 92% of PEPE2/USDT volume self-matched in 6h window." },
  { id: "coA", label: "Coordinator Alpha", subtitle: "Telegram pump caller", category: "coordinator", chain: "Ethereum", risk: 88, x: -520, y: -300, amount: "$3.1M", note: "Social signals precede 7 volume bursts (z ≥ 4.2) by 40–90s." },
  { id: "coB", label: "Coordinator Bravo", subtitle: "Spoof layering desk", category: "coordinator", chain: "BNB Chain", risk: 84, x: 560, y: -320, amount: "$2.6M", note: "Cancel-to-fill 96.4%; median order lifetime 1.8s." },
  { id: "cl1", label: "Sybil Cluster S-12", subtitle: "18 wallets · shared funder", category: "cluster", chain: "Solana", risk: 79, x: -620, y: 330, amount: "$1.9M" },
  { id: "cl2", label: "Sybil Cluster S-27", subtitle: "23 wallets · round-trips", category: "cluster", chain: "Arbitrum", risk: 74, x: 620, y: 360, amount: "$2.2M" },
  { id: "mix", label: "Mixer Hop · Tornado-like", subtitle: "Obfuscation relay", category: "mixer", chain: "Ethereum", risk: 91, x: -160, y: 420, amount: "$4.8M" },
  { id: "brg", label: "Cross-chain Bridge", subtitle: "ETH → TRON relay", category: "bridge", chain: "Tron", risk: 63, x: 240, y: 470, amount: "$3.9M" },
  { id: "pool", label: "DEX Pool PEPE2/USDT", subtitle: "Uniswap v3 · 0.3%", category: "pool", chain: "Ethereum", risk: 58, x: 30, y: -430, amount: "TVL $6.4M" },
  { id: "ex1", label: "Exchange Exit · CEX-A", subtitle: "KYC off-ramp", category: "exchange", chain: "BNB Chain", risk: 42, x: 960, y: 40, amount: "$5.7M" },
  { id: "ex2", label: "Exchange Exit · CEX-B", subtitle: "OTC desk deposit", category: "exchange", chain: "Tron", risk: 47, x: -960, y: 20, amount: "$2.4M" },
];

const FLOWS: IntelFlow[] = [
  { id: "f1", from: "coA", to: "syn", kind: "funding", value: 3.1, hops: 2, label: "gas funding" },
  { id: "f2", from: "coB", to: "syn", kind: "funding", value: 2.6, hops: 1 },
  { id: "f3", from: "syn", to: "pool", kind: "wash", value: 9.4, hops: 1, label: "self-matched 92%" },
  { id: "f4", from: "pool", to: "coB", kind: "wash", value: 4.1, hops: 1 },
  { id: "f5", from: "syn", to: "cl1", kind: "wash", value: 1.9, hops: 3 },
  { id: "f6", from: "syn", to: "cl2", kind: "wash", value: 2.2, hops: 2 },
  { id: "f7", from: "syn", to: "mix", kind: "exit", value: 4.8, hops: 4, label: "layering" },
  { id: "f8", from: "mix", to: "brg", kind: "bridge", value: 3.9, hops: 2, label: "ETH→TRON" },
  { id: "f9", from: "brg", to: "ex2", kind: "exit", value: 2.4, hops: 1 },
  { id: "f10", from: "cl2", to: "ex1", kind: "exit", value: 2.2, hops: 1 },
  { id: "f11", from: "coB", to: "ex1", kind: "exit", value: 3.5, hops: 1 },
  { id: "f12", from: "cl1", to: "ex2", kind: "bridge", value: 1.1, hops: 2 },
  { id: "f13", from: "coA", to: "cl1", kind: "funding", value: 0.8, hops: 1 },
];

export function buildIntel() {
  const rnd = mulberry32(9091);
  const entities: IntelEntity[] = [...HUBS];
  const flows: IntelFlow[] = [...FLOWS];
  const satellites: Record<string, number> = { coA: 16, coB: 16, cl1: 20, cl2: 20, mix: 9, ex1: 10, ex2: 10, syn: 12 };
  for (const [hub, n] of Object.entries(satellites)) {
    const h = HUBS.find((e) => e.id === hub)!;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
      const r = 150 + rnd() * 110;
      const id = `${hub}-w${i}`;
      const hex = Math.floor(rnd() * 0xffffff).toString(16).padStart(6, "0");
      entities.push({ id, hub, label: `0x${hex.slice(0, 4)}…${hex.slice(4)}`, subtitle: "Wallet", category: "wallet", chain: h.chain, risk: Math.round(h.risk * (0.5 + rnd() * 0.4)), x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r });
      flows.push({ id: `${id}-e`, from: hub, to: id, kind: h.category === "exchange" ? "exit" : h.category === "coordinator" ? "funding" : "wash", value: 0.05 + rnd() * 0.3, hops: 1 });
    }
  }
  return { entities, flows };
}
