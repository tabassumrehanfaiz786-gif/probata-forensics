/**
 * Real-world enforcement dossiers built only from public agency/court records.
 * No wallet addresses or tx hashes are included unless quoted in a cited source — verify before relying on any detail.
 */
export interface Dossier {
  id: string;
  title: string;
  year: number;
  typology: string;
  pattern: "oracle" | "wash_trading" | "pump";
  jurisdiction: string;
  facts: string[];
  proceedings: { forum: string; outcome: string }[];
  ukMar: string;
  mica: string;
  lesson: string;
  sources: { label: string; url: string }[];
}

export const DOSSIERS: Dossier[] = [
  {
    id: "mango-markets",
    title: "Mango Markets oracle manipulation (Eisenberg)",
    year: 2022,
    typology: "Oracle price manipulation on a thinly traded perpetual, then borrowing against inflated collateral",
    pattern: "oracle",
    jurisdiction: "United States (CFTC, SEC, DOJ SDNY)",
    facts: [
      "October 2022: large MNGO-PERP positions were opened between accounts controlled by the same person.",
      "Spot buying on thin venues pushed the MNGO price used by the protocol's oracle sharply higher.",
      "The inflated unrealised gain was used as collateral to withdraw roughly $110m of assets from the protocol.",
      "The trader publicly described the activity as a 'highly profitable trading strategy'.",
    ],
    proceedings: [
      { forum: "CFTC (Jan 2023)", outcome: "Civil complaint for manipulation and manipulative/deceptive device" },
      { forum: "SEC (Jan 2023)", outcome: "Civil complaint treating MNGO as a security" },
      { forum: "SDNY criminal trial (Apr 2024)", outcome: "Jury convicted on fraud and manipulation counts" },
      { forum: "SDNY post-trial (May 2025)", outcome: "Judge vacated the convictions (venue and evidentiary grounds) — check current status" },
    ],
    ukMar: "Art. 12(1)(a)(ii) MAR — transactions securing price at an abnormal or artificial level; Art. 12(1)(b) fictitious devices",
    mica: "Art. 91 MiCA — prohibition of market manipulation in crypto-assets",
    lesson: "Code-is-law arguments did not stop regulators charging manipulation, but the vacated verdict shows how venue and proof of deception remain contested.",
    sources: [
      { label: "CFTC press releases", url: "https://www.cftc.gov/PressRoom/PressReleases" },
      { label: "SEC litigation releases", url: "https://www.sec.gov/litigation/litreleases" },
      { label: "DOJ SDNY press releases", url: "https://www.justice.gov/usao-sdny/pr" },
    ],
  },
  {
    id: "token-mirrors",
    title: "Operation Token Mirrors — market makers for hire",
    year: 2024,
    typology: "Wash trading as a paid service to inflate token volume and price",
    pattern: "wash_trading",
    jurisdiction: "United States (DOJ D. Mass., SEC)",
    facts: [
      "October 2024: charges against token promoters and market-making firms, including Gotbit, ZM Quant and CLS Global.",
      "The FBI created its own token (NexFundAI) to identify firms willing to wash trade for clients.",
      "Firms allegedly used self-trading across many wallets to simulate organic volume.",
    ],
    proceedings: [
      { forum: "DOJ D. Massachusetts", outcome: "Criminal charges; several guilty pleas, including Gotbit's founder (2025)" },
      { forum: "SEC", outcome: "Parallel civil actions against promoters and market makers" },
    ],
    ukMar: "Art. 12(1)(a)(i) and Annex I A(a)–(c) MAR — false/misleading signals via wash trades and no change of beneficial ownership",
    mica: "Art. 91(2)(a) MiCA — transactions giving false or misleading signals as to supply, demand or price",
    lesson: "Attribution came from undercover engagement and firm records, not public tape alone — the same limit Probata's live leads carry.",
    sources: [
      { label: "DOJ D. Mass. press releases", url: "https://www.justice.gov/usao-ma/pr" },
      { label: "SEC press releases", url: "https://www.sec.gov/newsroom/press-releases" },
    ],
  },
  {
    id: "fca-market-abuse",
    title: "UK benchmark — FCA market abuse enforcement",
    year: 2024,
    typology: "How the UK proves manipulation: order data, communications and intent",
    pattern: "pump",
    jurisdiction: "United Kingdom (FCA, Upper Tribunal)",
    facts: [
      "UK crypto-asset manipulation is not yet a fully live FCA regime; the FCA is consulting on a crypto market abuse framework.",
      "Existing MAR cases (e.g. layering/spoofing in equities) show the evidence the FCA relies on: full order logs, trader identity and chat records.",
      "These are the facts a live public-tape lead must be supplemented with before a STOR can support enforcement.",
    ],
    proceedings: [
      { forum: "FCA Final Notices", outcome: "Search for 'market abuse' to review reasoning on artificial price and intent" },
      { forum: "FCA consultations", outcome: "Crypto-asset market abuse regime proposals (check latest CP)" },
    ],
    ukMar: "UK MAR Art. 12 and Art. 15; s.118 FSMA historical regime",
    mica: "Not applicable in the UK post-Brexit; use for EU comparison only",
    lesson: "Comparative point for your research: the UK regime is still forming for crypto, while MiCA Title VI already applies.",
    sources: [
      { label: "FCA Final Notices", url: "https://www.fca.org.uk/news/news-stories" },
      { label: "FCA cryptoassets hub", url: "https://www.fca.org.uk/firms/cryptoassets" },
    ],
  },
];
