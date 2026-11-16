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

// ---------- Manipulation topologies (fictional replay dossiers) ----------
export type PatternId = "global" | "wash" | "rug" | "oracle" | "spoof";
export interface PatternDef { id: PatternId; name: string; statute: string; summary: string }
export const PATTERNS: PatternDef[] = [
  { id: "global", name: "Global network", statute: "UK MAR Art. 12 · MiCA Art. 91", summary: "Full cross-chain syndicate: funding, wash ring, layering, bridge and exchange exits." },
  { id: "wash", name: "Wash trading ring", statute: "UK MAR Art. 12(1)(a) · MiCA Art. 91(2)(a)", summary: "Five sybil wallets funded by one gas source circulate the same tokens; net position change ≈ 0 while reported volume inflates 11×." },
  { id: "rug", name: "DEX rug-pull / liquidity drain", statute: "MiCA Art. 91(2)(c) · FSMA 2012 s.90", summary: "Deployer mints, insiders seed hype trades, then 94% of pool liquidity is withdrawn in one block and routed via a mixer to a CEX." },
  { id: "oracle", name: "Oracle / flash-loan exploit", statute: "UK MAR Art. 12(1)(b) · MiCA Art. 91(2)(b)", summary: "Single-block flash loan skews a thin AMM spot price used as an oracle, letting the attacker over-borrow from a lending pool." },
  { id: "spoof", name: "Spoofing / layering funnel", statute: "UK MAR Art. 12(2)(c) · MiCA Art. 91(2)(a)", summary: "Layered non-bona-fide orders on one side of the book move price; fills land on the opposite side, then orders cancel within ~2s." },
];

const tx = (s: number) => "0x" + Array.from({ length: 4 }, (_, i) => ((s * 2654435761 + i * 40503) >>> 0).toString(16).padStart(8, "0")).join("").slice(0, 16) + "…";
type P = { entities: IntelEntity[]; flows: IntelFlow[] };
const E = (id: string, label: string, subtitle: string, category: IntelCategory, chain: string, risk: number, x: number, y: number, amount?: string, note?: string): IntelEntity =>
  ({ id, label, subtitle, category, chain, risk, x, y, ...(amount ? { amount } : {}), ...(note ? { note } : {}) });
const F = (id: string, from: string, to: string, kind: FlowKind, value: number, label?: string): IntelFlow => ({ id, from, to, kind, value, hops: 1, ...(label ? { label } : {}) });

function washRing(): P {
  const entities = [E("funder", "Gas Funder 0x91c2…aa04", "Common funding source", "coordinator", "Ethereum", 89, 0, -460, "$0.4M", "Funded all 5 ring wallets within 3 minutes (tx " + tx(1) + ").")];
  const flows: IntelFlow[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    entities.push(E(`r${i}`, `Ring wallet R${i + 1}`, "Sybil · shared funder", i === 0 ? "primary" : "cluster", "Ethereum", 80 + i * 3, Math.cos(a) * 360, Math.sin(a) * 300 + 60, `$${(2.1 + i * 0.3).toFixed(1)}M vol`, `Net position change ${(i * 0.4 - 0.8).toFixed(1)}% across 214 round-trips. Tx ${tx(i + 10)}`));
    flows.push(F(`fu${i}`, "funder", `r${i}`, "funding", 0.08));
  }
  for (let i = 0; i < 5; i++) flows.push(F(`w${i}`, `r${i}`, `r${(i + 1) % 5}`, "wash", 2 + i * 0.4, i % 2 ? undefined : "round-trip"));
  entities.push(E("pool", "DEX Pool XYZ/USDT", "Volume venue", "pool", "Ethereum", 55, 0, 60, "TVL $1.2M", "Reported 24h volume $11.4M vs organic est. $1.0M."));
  for (let i = 0; i < 5; i++) flows.push(F(`p${i}`, `r${i}`, "pool", "wash", 0.6));
  return { entities, flows };
}
function rugPull(): P {
  const entities = [
    E("dep", "Deployer 0xdE11…7f20", "Token creator · owns mint", "primary", "BNB Chain", 96, -700, 0, "1B MOON", "Minted supply and retained LP ownership; renounce never executed. Tx " + tx(20)),
    E("pool", "PancakeSwap MOON/BNB", "Liquidity pool", "pool", "BNB Chain", 70, -200, 0, "TVL $3.6M → $0.2M", "94% of liquidity removed in block 34,551,902."),
    E("ins", "Insider Cluster I-4", "9 pre-funded buyers", "cluster", "BNB Chain", 82, -450, -330, "$0.9M", "Bought within 2 blocks of launch; dumped before drain."),
    E("hype", "Promo Channel", "Influencer shill wallets", "coordinator", "BNB Chain", 77, -450, 330, "$0.3M"),
    E("mix", "Mixer Hop", "Obfuscation relay", "mixer", "Ethereum", 92, 260, -120, "$3.1M"),
    E("brg", "Bridge BSC→ETH", "Cross-chain relay", "bridge", "Ethereum", 61, 260, 220, "$3.1M"),
    E("cex", "CEX Deposit · Exchange-C", "KYC off-ramp — subpoena target", "exchange", "Ethereum", 48, 720, 40, "$2.9M", "Deposit address linked to verified account; preservation request recommended."),
  ];
  const flows = [F("a", "dep", "pool", "funding", 3.6, "seed LP"), F("b", "ins", "pool", "wash", 0.9, "launch snipes"), F("c", "hype", "pool", "funding", 0.3), F("d", "pool", "dep", "exit", 3.4, "LP withdrawal 94%"), F("e", "dep", "brg", "bridge", 3.1, "bridge out"), F("f", "brg", "mix", "exit", 3.1), F("g", "mix", "cex", "exit", 2.9, "cash-out")];
  return { entities, flows };
}
function oracle(): P {
  const entities = [
    E("atk", "Attacker 0x5a1f…e9b3", "Exploit contract deployer", "primary", "Arbitrum", 98, -700, 0, "$8.7M profit", "All steps executed atomically in tx " + tx(30)),
    E("fl", "Flash-loan Provider", "Uncollateralised loan · 1 block", "bridge", "Arbitrum", 40, -300, -300, "$40M USDC"),
    E("amm", "Thin AMM Pool ABC/USDC", "Used as price oracle", "pool", "Arbitrum", 75, 0, 0, "Spot +412%", "Spot price moved 412% within the block; TWAP not used."),
    E("lend", "Lending Protocol", "Victim — reads AMM spot", "exchange", "Arbitrum", 66, 380, -300, "-$8.7M", "Collateral overvalued 5.1×; bad debt created."),
    E("mix", "Mixer Hop", "Proceeds laundering", "mixer", "Ethereum", 93, 700, 60, "$8.7M"),
  ];
  const flows = [F("a", "fl", "atk", "funding", 40, "flash borrow"), F("b", "atk", "amm", "wash", 38, "skew spot"), F("c", "atk", "lend", "funding", 6, "post collateral"), F("d", "lend", "atk", "exit", 14.7, "over-borrow"), F("e", "atk", "fl", "exit", 40.04, "repay"), F("f", "atk", "mix", "exit", 8.7, "launder")];
  return { entities, flows };
}
function spoof(): P {
  const entities = [E("desk", "Spoof Desk Account", "Coordinator Bravo · CEX sub-account", "primary", "BNB Chain", 91, -650, 0, "$2.6M", "Cancel-to-fill 96.4%; median order life 1.8s.")];
  const flows: IntelFlow[] = [];
  for (let i = 0; i < 6; i++) {
    entities.push(E(`l${i}`, `Bid layer L${i + 1}`, `${(0.5 + i * 0.25).toFixed(2)}% below mid · cancelled`, "cluster", "BNB Chain", 70 + i * 3, -200, -375 + i * 150, `${120 + i * 40} BTC`));
    flows.push(F(`s${i}`, "desk", `l${i}`, "funding", 1 + i * 0.3, i === 0 ? "layer & cancel" : undefined));
  }
  entities.push(E("book", "Order Book BTC/USDT", "Mid moved +0.8% in 40s", "pool", "BNB Chain", 60, 200, 0, "Imbalance 7.2×"));
  entities.push(E("fill", "Ask-side Fills", "Genuine sells executed into lifted price", "exchange", "BNB Chain", 80, 640, 0, "$1.9M", "Profit realised on opposite side of spoofed layers."));
  for (let i = 0; i < 6; i++) flows.push(F(`b${i}`, `l${i}`, "book", "wash", 0.8));
  flows.push(F("x", "book", "fill", "exit", 1.9, "opposite-side fill"), F("y", "fill", "desk", "exit", 1.9, "profit"));
  return { entities, flows };
}
export function buildPattern(id: PatternId): P {
  return id === "wash" ? washRing() : id === "rug" ? rugPull() : id === "oracle" ? oracle() : id === "spoof" ? spoof() : buildIntel();
}
