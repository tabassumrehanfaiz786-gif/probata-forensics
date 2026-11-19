/**
 * Real-world enforcement dossiers built only from public agency/court records.
 * Every fact and proceeding carries its own official source (agency, court or regulator site).
 * No wallet addresses or tx hashes are included unless quoted in a cited source.
 */
export interface Cite { label: string; url: string; pin?: string }
export interface Fact { text: string; source: Cite }
export interface Dossier {
  id: string;
  title: string;
  year: number;
  typology: string;
  pattern: "oracle" | "wash_trading" | "pump" | "spoofing";
  jurisdiction: string;
  facts: Fact[];
  proceedings: { forum: string; outcome: string; source: Cite }[];
  ukMar: string;
  mica: string;
  lesson: string;
  law: Cite[];
}

/** Hosts accepted as official sources: regulators, prosecutors, courts and legislation sites. */
export const OFFICIAL_HOSTS = ["cftc.gov", "sec.gov", "justice.gov", "uscourts.gov", "fca.org.uk", "legislation.gov.uk", "eur-lex.europa.eu"];

const CFTC_COMPLAINT: Cite = { label: "CFTC v. Eisenberg, Complaint (9 Jan 2023)", url: "https://www.cftc.gov/media/8046/enfeisenbergcomplaint010923/download" };
const SEC_COMPLAINT: Cite = { label: "SEC v. Eisenberg, Complaint (20 Jan 2023)", url: "https://www.sec.gov/files/litigation/complaints/2023/comp-pr2023-13.pdf" };
const DOJ_MIRRORS: Cite = { label: "DOJ D. Mass. press release (9 Oct 2024)", url: "https://www.justice.gov/usao-ma/pr/eighteen-individuals-and-entities-charged-international-operation-targeting-widespread" };
const SEC_MIRRORS: Cite = { label: "SEC press release 2024-166 (9 Oct 2024)", url: "https://www.sec.gov/newsroom/press-releases/2024-166" };
const FCA_ABB: Cite = { label: "FCA Final Notice: Corrado Abbattista (15 Dec 2020)", url: "https://www.fca.org.uk/publication/final-notices/corrado-abbattista-dec-2020.pdf" };
const UK_MAR_12: Cite = { label: "UK MAR Art. 12 (legislation.gov.uk)", url: "https://www.legislation.gov.uk/eur/2014/596/article/12" };
const MICA: Cite = { label: "MiCA, Regulation (EU) 2023/1114 (EUR-Lex)", url: "https://eur-lex.europa.eu/eli/reg/2023/1114/oj/eng" };

export const DOSSIERS: Dossier[] = [
  {
    id: "mango-markets",
    title: "Mango Markets oracle manipulation (Eisenberg)",
    year: 2022,
    typology: "Oracle price manipulation on a thinly traded perpetual, then borrowing against inflated collateral",
    pattern: "oracle",
    jurisdiction: "United States (CFTC, SEC, DOJ SDNY)",
    facts: [
      { text: "On 11 October 2022, the complaint alleges, two accounts controlled by the same person opened offsetting long and short MNGO perpetual positions (≈ $19m each, over 400 million MNGO swaps), after $5m USDC was deposited into each.", source: { ...CFTC_COMPLAINT, pin: "¶31" } },
      { text: "MNGO was bought on three exchanges that fed Mango's oracle within about 30 minutes, lifting the oracle-derived price from about $0.04 to about $0.54 (over 13-fold).", source: { ...CFTC_COMPLAINT, pin: "¶¶5–6, 32–38" } },
      { text: "The inflated long position was used to borrow and withdraw other crypto-assets — over $110m per the CFTC; the SEC puts it at about $116m.", source: { ...SEC_COMPLAINT, pin: "¶¶1, 5" } },
      { text: "MNGO's price on Mango rose more than 2,200% and daily volume was over 2,000% above its prior ten-day average.", source: { ...SEC_COMPLAINT, pin: "¶4" } },
      { text: "On 15 October 2022 he tweeted that he was “involved with a team that operated a highly profitable trading strategy last week”, and said the actions were legal.", source: { ...CFTC_COMPLAINT, pin: "¶46" } },
    ],
    proceedings: [
      { forum: "CFTC (9 Jan 2023)", outcome: "Civil complaint for manipulation and use of a manipulative or deceptive device", source: { label: "CFTC press release 8647-23", url: "https://www.cftc.gov/PressRoom/PressReleases/8647-23" } },
      { forum: "SEC (20 Jan 2023)", outcome: "Civil complaint treating MNGO as a security", source: { label: "SEC press release 2023-13", url: "https://www.sec.gov/newsroom/press-releases/2023-13" } },
      { forum: "SDNY jury (18 Apr 2024)", outcome: "Convicted of commodities fraud, commodities market manipulation and wire fraud", source: { label: "DOJ SDNY press release", url: "https://www.justice.gov/usao-sdny/pr/man-convicted-110-million-cryptocurrency-scheme" } },
      { forum: "SDNY post-trial (23 May 2025)", outcome: "Judge vacated counts one and two (venue) and entered acquittal on count three (wire fraud) — check later appeals", source: { label: "US v. Eisenberg, Opinion and Order, 23-cr-10 (AS), Doc. 220", url: "https://www.nysd.uscourts.gov/sites/default/files/2025-05/23cr10%20Opinion%20and%20Order.pdf" } },
    ],
    ukMar: "Art. 12(1)(a)(ii) MAR — transactions securing price at an abnormal or artificial level; Art. 12(1)(b) fictitious devices",
    mica: "Art. 91 MiCA — prohibition of market manipulation in crypto-assets",
    lesson: "Regulators charged manipulation despite code-is-law arguments, but the vacated verdict shows that venue and proof of deception remain contested.",
    law: [UK_MAR_12, MICA],
  },
  {
    id: "token-mirrors",
    title: "Operation Token Mirrors — market makers for hire",
    year: 2024,
    typology: "Wash trading sold as a service to inflate token volume and price",
    pattern: "wash_trading",
    jurisdiction: "United States (DOJ D. Mass., SEC)",
    facts: [
      { text: "In October 2024, 18 individuals and entities were charged, including four crypto companies and four purported market makers: Gotbit, ZM Quant, CLS Global and MyTrade.", source: DOJ_MIRRORS },
      { text: "The FBI created its own crypto company and token, NexFundAI, as part of the investigation.", source: DOJ_MIRRORS },
      { text: "Defendants allegedly ran sham (wash) trades to create the appearance of genuine trading activity and attract buyers.", source: DOJ_MIRRORS },
      { text: "Over $25m was seized and trading bots linked to wash trading in about 60 crypto-assets were disabled.", source: DOJ_MIRRORS },
      { text: "The SEC alleged that ZM Quant and CLS Global provided artificial volume for the FBI-directed token.", source: SEC_MIRRORS },
    ],
    proceedings: [
      { forum: "DOJ D. Massachusetts (Oct 2024)", outcome: "Criminal charges against promoters and market makers", source: DOJ_MIRRORS },
      { forum: "SEC (Oct 2024)", outcome: "Parallel civil actions against three market makers and nine individuals", source: SEC_MIRRORS },
      { forum: "D. Mass. (21 Mar 2025)", outcome: "Gotbit and founder Aleksei Andriunin pleaded guilty; ≈ $23m forfeiture agreed", source: { label: "DOJ D. Mass. release (27 Mar 2025)", url: "https://www.justice.gov/usao-ma/pr/united-states-seeks-civil-forfeiture-approximately-23-million-cryptocurrency-seized" } },
      { forum: "D. Mass. sentencing (Jun 2025)", outcome: "Andriunin: 8 months' imprisonment; Gotbit: 5 years' probation and must cease operating", source: { label: "DOJ D. Mass. release (13 Jun 2025)", url: "https://www.justice.gov/usao-ma/pr/cryptocurrency-financial-services-firm-gotbit-and-founder-sentenced-market-manipulation" } },
    ],
    ukMar: "Art. 12(1)(a)(i) and Annex I A MAR — false or misleading signals through wash trades with no change of beneficial ownership",
    mica: "Art. 91(2)(a) MiCA — transactions giving false or misleading signals as to supply, demand or price",
    lesson: "Attribution came from an undercover operation and firm records, not public tape alone — the same limit Probata's live leads carry.",
    law: [UK_MAR_12, MICA],
  },
  {
    id: "fca-market-abuse",
    title: "UK benchmark — FCA market abuse enforcement",
    year: 2020,
    typology: "How the UK proves manipulation: order data and trader conduct",
    pattern: "spoofing",
    jurisdiction: "United Kingdom (FCA)",
    facts: [
      { text: "UK crypto market abuse rules are still being written: the FCA published Discussion Paper DP24/4 in December 2024.", source: { label: "FCA DP24/4 (16 Dec 2024)", url: "https://www.fca.org.uk/publications/discussion-papers/dp24-4-regulating-cryptoassets" } },
      { text: "It followed with Consultation Paper CP25/41 on admissions, disclosures and a market abuse regime for cryptoassets (responses by 12 Feb 2026).", source: { label: "FCA CP25/41 (16 Dec 2025)", url: "https://www.fca.org.uk/publications/consultation-papers/cp25-41-regulating-cryptoassets-admissions-disclosures-market-abuse-regime-cryptoassets" } },
      { text: "In Abbattista (2020) the FCA fined a CIO £100,000 and banned him for manipulation contrary to MAR Art. 15, for placing large misleading orders opposite smaller genuine ones in 2017.", source: FCA_ABB },
      { text: "The Final Notice reconstructs timestamped orders, sizes, quotes and cancellations (Annex C) — the evidence a public-tape lead lacks.", source: { ...FCA_ABB, pin: "Annex C" } },
      { text: "The FCA said it found the conduct through surveillance of consolidated order-book data across venues.", source: { label: "FCA press release (15 Dec 2020)", url: "https://www.fca.org.uk/news/press-releases/fca-fines-and-prohibits-hedge-fund-chief-investment-officer-market-abuse" } },
    ],
    proceedings: [
      { forum: "FCA Final Notice (Dec 2020)", outcome: "£100,000 penalty and prohibition order — UK MAR Art. 15", source: FCA_ABB },
      { forum: "FCA CP25/41 (Dec 2025)", outcome: "Proposed crypto market abuse regime under consultation", source: { label: "CP25/41 (PDF)", url: "https://www.fca.org.uk/publication/consultation/cp25-41.pdf" } },
    ],
    ukMar: "UK MAR Art. 12 and Art. 15",
    mica: "Not applicable in the UK post-Brexit; use for EU comparison only",
    lesson: "For your research: the UK crypto regime is still forming, while MiCA Title VI already applies in the EU.",
    law: [UK_MAR_12, MICA],
  },
];
