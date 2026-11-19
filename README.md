# Probata Forensics: Autonomous Market Abuse Surveillance & Cryptographic Evidence Engine

[![Live Application](https://img.shields.io/badge/Live%20Demo-probata--forensics.lovable.app-0052FF?style=flat-square&logo=googlechrome&logoColor=white)](https://probata-forensics.lovable.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-tabassumrehanfaiz786--gif%2Fprobata--forensics-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/tabassumrehanfaiz786-gif/probata-forensics)
[![ORCID Identifier](https://img.shields.io/badge/ORCID-0000--000X--XXXX--XXXX-A6CE39?style=flat-square&logo=orcid&logoColor=white)](https://orcid.org/0000-000X-XXXX-XXXX)
[![SSRN Author / Paper](https://img.shields.io/badge/SSRN-Research%20Paper%20ID-12589e?style=flat-square&logo=ssrn&logoColor=white)](https://papers.ssrn.com/sol3/cf_dev/AbsByAuth.cfm?per_id=XXXXXXX)
[![License: Faizan Rehan](https://img.shields.io/badge/License-Copyright%20Faizan%20Rehan-red?style=flat-square)](LICENSE)
[![Build & Tests](https://img.shields.io/badge/Tests-22%2F22%20Passing-brightgreen?style=flat-square)](src/test/)

---

## 1. Executive Summary & Research Motivation

The expansion of high-frequency digital asset venues and decentralized protocol ecosystems has created severe enforcement gaps for international market authorities. Traditional surveillance systems designed for centralized order books struggle with cross-venue coordination, on-chain liquidity manipulation, and decentralized protocol exploits.

**Probata Forensics** is an applied legal-computational intelligence engine engineered to bridge quantitative market anomaly surveillance with statutory evidentiary admissibility requirements under:
1. **UK Market Abuse Regulation (UK MAR)** (retained EU Regulation 596/2014 via the Market Abuse Regulations 2019, SI 2019/310).
2. **EU Markets in Crypto-Assets Regulation (MiCA)** (Regulation (EU) 2023/1114, Articles 88, 89, 91, and 92).
3. **UK Evidence Law Standards**: Civil Evidence Act 1995 (ss. 8 & 9 authenticity conditions) and the common law doctrine of computer-generated physical data admissibility.

Probata resolves the tension between heuristic detection and evidentiary standards by implementing a **two-tier surveillance pipeline**:
- **Tier 1 (Public Exchange Lead Generator)**: High-throughput ingestion of live aggregate trade streams (Binance, Coinbase, Kraken failover) computing rolling microstructure anomaly metrics (repeated sizing, velocity bursts, churn-to-drift ratios).
- **Tier 2 (Forensic Evidence Packaging)**: Cryptographic SHA-256 state freezing, team role-based governance, and automated prefilling of formal regulatory filings (FCA STOR and MiCA Art. 92 notifications).

---

## 2. System Architecture

```text
                     ┌──────────────────────────────────────────────┐
                     │           DATA INGESTION LAYER               │
                     └──────────────────────┬───────────────────────┘
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
    [Live Ticker Buffer]                                     [Deterministic Replay Engine]
    WebSocket Stream (Binance/Coinbase/Kraken)                Reproducible PRNG Seed Datasets
    Rolling 500-tick Microstructure Cache                     9 Ground-Truth Benchmark Scenarios
               │                                                         │
               └────────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │          FORENSIC SCORING CORE               │
                     │  - Volume Clustering (Repeated Lot Sizes)    │
                     │  - Order Velocity & Price Drift Asymmetry    │
                     │  - DEX Liquidity Drain / Pool Skew Ratio     │
                     │  - Oracle / Flash Loan Dislocation Metric    │
                     └──────────────────────┬───────────────────────┘
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
    [Interactive Intel Graph]                                [Cryptographic Evidence Vault]
    - Force-directed multi-hop canvas                        - Client-side SHA-256 seal
    - Risk-colored entity clusters                           - Team RBAC (Admin/Compliance/Analyst)
    - Suspicious flow tracer                                 - Append-only audit logging
               │                                                         │
               └────────────────────────────┬────────────────────────────┘
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │          REGULATORY ADMISSIBILITY            │
                     │  - 7-Point Evidentiary Integrity Checklist   │
                     │  - Draft FCA STOR (UK MAR Art. 16) Markdown  │
                     │  - Draft MiCA Art. 92 Regulatory Document    │
                     └──────────────────────────────────────────────┘
