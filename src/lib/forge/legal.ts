/**
 * Versioned legal templates and the rule-based mapping from a detection to legal elements.
 * Element text is a paraphrase for triage; it is not a substitute for the instrument itself.
 * Mapping never concludes that market abuse occurred — it identifies provisions that may be
 * engaged, the facts relevant to them, and the strongest arguments against.
 */
import { fmtCompact, fmtDuration, fmtNum, fmtTs, pct } from "./format";
import type { Detection, PatternType } from "./types";

export type Regime = "MARC" | "MiCA";

export interface LegalElement {
  id: string;
  citation: string;
  title: string;
  summary: string;
  patterns: PatternType[];
}

export interface LegalTemplate {
  regime: Regime;
  version: string;
  status: "active" | "superseded";
  instrument: string;
  effective: string;
  sourceNote: string;
  elements: LegalElement[];
  changelog: string;
}

export const LEGAL_TEMPLATES: LegalTemplate[] = [
  {
    regime: "MARC",
    version: "MARC-T 2026.2",
    status: "active",
    instrument: "The Financial Services and Markets Act 2000 (Cryptoassets) Regulations 2026 (SI 2026/102); FCA PS26/9 (CRYPTO sourcebook)",
    effective: "2026-06-30",
    sourceNote: "Element numbering follows the market manipulation definition (reg. 19 in the laid draft) and prohibition (reg. 28 per FCA PS26/9 glossary). Verify numbering against the made instrument before external use.",
    changelog: "Updated to the made SI and FCA final rules (PS26/9). Added reference to the prohibition provision.",
    elements: [
      { id: "MARC-a-i", citation: "Reg. 19(1)(a)(i)", title: "False or misleading signals", summary: "Entering into a transaction, placing an order to trade or other behaviour which gives, or is likely to give, false or misleading signals as to the supply of, demand for, or price of a relevant qualifying cryptoasset.", patterns: ["wash_trading", "spoofing", "coordinated_pump"] },
      { id: "MARC-a-ii", citation: "Reg. 19(1)(a)(ii)", title: "Abnormal or artificial price level", summary: "Behaviour which secures, or is likely to secure, the price of a relevant qualifying cryptoasset at an abnormal or artificial level.", patterns: ["coordinated_pump", "wash_trading"] },
      { id: "MARC-b", citation: "Reg. 19(1)(b)", title: "Fictitious device or deception", summary: "Transactions, orders or other behaviour which affect, or are likely to affect, price while employing a fictitious device or any other form of deception or contrivance.", patterns: ["coordinated_pump", "spoofing", "wash_trading"] },
      { id: "MARC-c", citation: "Reg. 19(1)(c)", title: "Dissemination of false or misleading information", summary: "Disseminating information, including rumours, through the media or internet which gives false or misleading signals, where the person knew or ought to have known it was false or misleading.", patterns: ["coordinated_pump"] },
    ],
  },
  {
    regime: "MARC",
    version: "MARC-T 2025.4",
    status: "superseded",
    instrument: "Draft Financial Services and Markets Act 2000 (Cryptoassets) Regulations 2025; FCA CP25/41",
    effective: "2025-12-16",
    sourceNote: "Based on the laid draft and FCA consultation. Retained for packages generated before 30 June 2026.",
    changelog: "Initial template from the draft SI and CP25/41.",
    elements: [],
  },
  {
    regime: "MiCA",
    version: "MiCA91-T 2024.3",
    status: "active",
    instrument: "Regulation (EU) 2023/1114 (MiCA), Article 91 — Prohibition of market manipulation",
    effective: "2024-12-30",
    sourceNote: "Title VI applies from 30 December 2024. Paraphrased for triage; consult the Official Journal text and any ESMA guidelines.",
    changelog: "Added Art. 91(3)(c) opinion-voicing indicator for promotional activity.",
    elements: [
      { id: "MiCA-2-a-i", citation: "Art. 91(2)(a)(i)", title: "False or misleading signals", summary: "Unless carried out for legitimate reasons, entering into a transaction, placing an order to trade or other behaviour which gives, or is likely to give, false or misleading signals as to the supply of, demand for, or price of, a crypto-asset.", patterns: ["wash_trading", "spoofing", "coordinated_pump"] },
      { id: "MiCA-2-a-ii", citation: "Art. 91(2)(a)(ii)", title: "Abnormal or artificial price level", summary: "Unless carried out for legitimate reasons, behaviour which secures, or is likely to secure, the price of one or several crypto-assets at an abnormal or artificial level.", patterns: ["coordinated_pump", "wash_trading"] },
      { id: "MiCA-2-b", citation: "Art. 91(2)(b)", title: "Fictitious devices or deception", summary: "Transactions, orders or other behaviour affecting, or likely to affect, price while employing fictitious devices or any other form of deception or contrivance.", patterns: ["coordinated_pump", "spoofing", "wash_trading"] },
      { id: "MiCA-2-c", citation: "Art. 91(2)(c)", title: "Dissemination of false or misleading information", summary: "Disseminating information through the media, including the internet, which gives false or misleading signals, where the person knew or ought to have known that the information was false or misleading.", patterns: ["coordinated_pump"] },
      { id: "MiCA-3-b", citation: "Art. 91(3)(b)", title: "Orders that disrupt or mislead (incl. cancellations)", summary: "Placing orders, including cancellations or modifications, which disrupt the platform, make it harder to identify genuine orders, or create a false or misleading signal about supply, demand or price.", patterns: ["spoofing"] },
      { id: "MiCA-3-c", citation: "Art. 91(3)(c)", title: "Voicing opinions while holding positions", summary: "Taking advantage of access to media by voicing an opinion about a crypto-asset while having previously taken positions in it, and profiting from the impact, without disclosing the conflict of interest.", patterns: ["coordinated_pump"] },
    ],
  },
];

export const activeTemplate = (regime: Regime) => LEGAL_TEMPLATES.find((t) => t.regime === regime && t.status === "active")!;

export type Strength = "strong" | "moderate" | "limited";

export interface EngagedElement {
  element: LegalElement;
  strength: Strength;
  rationale: string;
}

export interface LegalMapping {
  regime: Regime;
  templateVersion: string;
  instrument: string;
  engaged: EngagedElement[];
  narrative: string;
  intentIndicators: string[];
  counterArguments: string[];
  nextSteps: string[];
  caveat: string;
}

const strengthOf = (unit: number): Strength => (unit >= 0.8 ? "strong" : unit >= 0.5 ? "moderate" : "limited");
const f = (d: Detection, key: string) => {
  const x = d.factors.find((q) => q.key === key);
  return x ? x.score / x.weight : 0;
};

function elementRationale(d: Detection, el: LegalElement): { strength: Strength; rationale: string } | null {
  const r = d.raw;
  const kind = el.id.replace(/^(MARC|MiCA)-/, "");
  if (d.pattern === "wash_trading") {
    if (kind === "a-i" || kind === "2-a-i") return { strength: strengthOf((f(d, "matched") + f(d, "net")) / 2), rationale: `${fmtNum(r.pairs)} matched trades with ${pct(r.netRatio, 2)} net position change produced reported volume without a corresponding change in beneficial ownership, which may signal demand and liquidity that did not exist.` };
    if (kind === "a-ii" || kind === "2-a-ii") return Math.abs(r.priceDrift) > 0.02 ? { strength: "limited", rationale: `Price drifted ${pct(r.priceDrift, 1)} over the window; any effect on price level is secondary to the volume signal.` } : null;
    if (kind === "b" || kind === "2-b") return r.linked ? { strength: strengthOf(f(d, "funding")), rationale: "Use of multiple accounts funded from a common source to trade with each other may amount to a fictitious device concealing that both sides are the same economic interest." } : null;
  }
  if (d.pattern === "spoofing") {
    if (kind === "a-i" || kind === "2-a-i") return { strength: strengthOf((f(d, "life") + f(d, "opp")) / 2), rationale: `${fmtNum(r.largeCount)} large orders on the ${r.askSide ? "ask" : "bid"} side were cancelled after a median ${fmtNum(r.life)} ms, indicating displayed interest that was not intended to execute.` };
    if (kind === "b" || kind === "2-b") return { strength: strengthOf(f(d, "opp")), rationale: `${pct(r.oppFrac)} of the account's fills executed on the opposite side while its large orders were resting, consistent with orders used as a contrivance to obtain better execution.` };
    if (kind === "3-b") return { strength: strengthOf((f(d, "ctf") + f(d, "life") + f(d, "size")) / 3), rationale: `Repeated placement and cancellation (${r.ctf.toFixed(1)}:1 cancel-to-fill) of orders ${r.largeShare >= 0.5 ? "mostly" : "partly"} at ≥ the size threshold may make it more difficult for others to identify genuine orders.` };
  }
  if (d.pattern === "coordinated_pump") {
    if (kind === "a-i" || kind === "2-a-i") return { strength: strengthOf((f(d, "conc") + f(d, "z")) / 2), rationale: `Concentrated buying (top-10 share ${pct(r.topShare)}) produced a volume z-score of ${r.z.toFixed(1)}, which may have signalled broad-based demand.` };
    if (kind === "a-ii" || kind === "2-a-ii") return { strength: strengthOf(f(d, "price")), rationale: `Price rose ${pct(r.priceChange)} within the window before the cohort exited ${pct(r.dumpRatio)} of its position.` };
    if (kind === "b" || kind === "2-b") return r.fundingFrac > 0.3 ? { strength: strengthOf(f(d, "funding")), rationale: "Coordinated buying across commonly-funded wallets may constitute a contrivance concealing a single interest." } : null;
    if (kind === "c" || kind === "2-c") return r.social > 0 ? { strength: "moderate", rationale: `${r.social} promotional post(s) referenced an unverified listing shortly before the spike. Falsity and the poster's knowledge are not established by this data.` } : null;
    if (kind === "3-c") return r.social > 0 && r.dumpRatio > 0.5 ? { strength: "limited", rationale: "Applies only if the poster(s) can be linked to the cohort wallets; that link is not established by on-chain data." } : null;
  }
  return null;
}

function narrative(d: Detection): string {
  const r = d.raw;
  const win = `between ${fmtTs(d.window.start)} and ${fmtTs(d.window.end)} (${fmtDuration(d.window.end - d.window.start)})`;
  const where = `${d.pair} on ${d.venue.name}${d.venue.chain ? ` (${d.venue.chain})` : ""}`;
  if (d.pattern === "wash_trading")
    return `${win}, ${r.clusterSize === 1 ? "a single account" : `${r.clusterSize} accounts${r.linked ? " funded from a common address" : ""}`} traded ${where}. Of the cluster's volume, ${pct(r.matchedRatio)} was either crossed between cluster accounts (${fmtNum(r.cross)} trades) or offset by a near-identical opposite trade (${fmtNum(r.roundTrips)} round-trips). Net position change was ${pct(r.netRatio, 2)}, and the activity represented ${pct(r.venueShare)} of total ${d.pair} volume at the venue in the period.`;
  if (d.pattern === "spoofing")
    return `${win}, account ${d.wallets[0]} placed ${fmtNum(r.placed)} orders in ${where}, of which ${fmtNum(r.largeCount)} were at least the configured multiple of the venue median order size. Large orders on the ${r.askSide ? "ask" : "bid"} side were typically cancelled within ${fmtNum(r.life)} ms. ${fmtNum(r.oppFills)} of the account's ${fmtNum(r.filled)} fills (${pct(r.oppFrac)}) executed on the ${r.askSide ? "bid" : "ask"} side while those orders were resting.`;
  return `${win}, ${where} saw a volume spike (peak z-score ${r.z.toFixed(1)}) and a price increase of ${pct(r.priceChange)}. The top ten buyers accounted for ${pct(r.topShare)} of buy volume; ${r.fundingFrac > 0 ? `${pct(r.fundingFrac, 0)} of them were funded from a common address before the event` : "no common funding was identified among them"}. ${r.social ? `${r.social} promotional post(s) preceded the spike. ` : ""}The identified cohort sold ${pct(r.dumpRatio)} of its spike purchases within the following hour.`;
}

function intent(d: Detection): string[] {
  const r = d.raw;
  if (d.pattern === "wash_trading") return [
    `Repetition: ${fmtNum(r.pairs)} matched events rather than an isolated occurrence.`,
    "Uniform lot sizes and short offset intervals are difficult to reconcile with independent decision-making.",
    ...(r.linked ? ["Pre-positioning: accounts were funded from the same address shortly before trading began."] : []),
    "Absence of economic purpose: near-zero net position change implies no change in market risk.",
  ];
  if (d.pattern === "spoofing") return [
    `Systematic pattern: ${fmtNum(r.largeCount)} large orders over the window with consistent short lifetimes.`,
    "Orders were cancelled before price reached them, typically after opposite-side execution.",
    "Order sizes were materially larger than the account's executed trades.",
  ];
  return [
    ...(r.fundingFrac > 0.3 ? ["Common funding of buyers shortly before the event suggests pre-arrangement."] : []),
    ...(r.social ? ["Timing of promotional posts relative to the first cohort buys."] : []),
    `Rapid exit: ${pct(r.dumpRatio)} of purchases sold soon after the peak, consistent with profit-taking on an induced move.`,
  ];
}

function counter(d: Detection, regime: Regime): string[] {
  const r = d.raw;
  const legit = regime === "MiCA"
    ? "Art. 91(2)(a) excludes behaviour carried out for legitimate reasons; the burden of establishing that falls on the person concerned, but it must be considered."
    : "Consider whether any legitimate commercial rationale exists; the FCA's assessment of behaviour takes account of the context and the person's purpose.";
  const common = [legit, "Detection is statistical and rule-based; no admission, communication or KYC record supports the inference of a single beneficial owner or intent."];
  if (d.pattern === "wash_trading") return [
    ...common,
    "Trades between accounts may reflect internal treasury transfers, portfolio rebalancing between entities, or a custodian's omnibus structure.",
    r.venueShare < 0.05 ? `Share of venue volume was only ${pct(r.venueShare)}, which weakens the inference that other participants were, or were likely to be, misled.` : "High share of volume may also arise from a thin market in which the cluster is the main liquidity provider.",
    "Funding from a common address can occur where wallets are provisioned by a payments processor, OTC desk or airdrop distributor.",
  ];
  if (d.pattern === "spoofing") return [
    ...common,
    "High cancellation rates are inherent to electronic market making and risk management; rapid cancels can reflect latency arbitrage or changing conditions.",
    "Without a full depth-of-book snapshot it cannot be shown that the orders moved prevailing prices.",
    "Opposite-side fills could be coincidental if the account quotes both sides continuously.",
  ];
  return [
    ...common,
    "Volume and price spikes in low-cap tokens frequently arise from genuine news, listings or community enthusiasm.",
    r.social ? "Promotional posts may be independent of the trading cohort; no link between poster and wallets has been established." : "No promotional signal was found, which weakens any dissemination-based theory.",
    "Early buyers selling into strength is consistent with ordinary momentum trading.",
  ];
}

function nextSteps(d: Detection): string[] {
  if (d.pattern === "wash_trading") return [
    "Request KYC and beneficial ownership records for the cluster accounts from the venue.",
    "Extend analysis to other venues and pairs traded by the cluster in the same period.",
    "Trace the common funding address upstream for further linked wallets.",
    "Obtain any market-making or liquidity agreements covering the accounts.",
  ];
  if (d.pattern === "spoofing") return [
    "Obtain the venue's private order log (including order IDs and client IDs) to confirm attribution.",
    "Reconstruct full depth-of-book at each large order placement to measure price effect.",
    "Check whether the account holds a market-making agreement with quoting obligations.",
    "Review the account's activity on other pairs for the same pattern.",
  ];
  return [
    "Preserve and archive the promotional posts and channel membership data.",
    "Trace cohort funding upstream and downstream (exit to CEX deposit addresses).",
    "Request deposit-address KYC from exchanges receiving cohort exits.",
    "Check whether the token issuer or its connected persons were involved or made disclosures.",
  ];
}

export function mapLegal(d: Detection, regime: Regime): LegalMapping {
  const t = activeTemplate(regime);
  const engaged = t.elements
    .filter((el) => el.patterns.includes(d.pattern))
    .map((el) => {
      const x = elementRationale(d, el);
      return x ? { element: el, ...x } : null;
    })
    .filter((x): x is EngagedElement => x !== null);
  return {
    regime,
    templateVersion: t.version,
    instrument: t.instrument,
    engaged,
    narrative: narrative(d),
    intentIndicators: intent(d),
    counterArguments: counter(d, regime),
    nextSteps: nextSteps(d),
    caveat: `This analysis identifies provisions that may be engaged on the observed facts. It does not determine that market manipulation occurred and is not legal advice. ${t.sourceNote}`,
  };
}

export const STRENGTH_LABEL: Record<Strength, string> = { strong: "Strong indicators", moderate: "Moderate indicators", limited: "Limited indicators" };

export { fmtCompact };
