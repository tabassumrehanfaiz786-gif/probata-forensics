import { describe, expect, it } from "vitest";
import { patternForAlerts, liveCaseRef, liveToScenario, ANON_TAKER } from "@/lib/forge/promote";
import { DOSSIERS } from "@/lib/forge/dossiers";

const buf = Array.from({ length: 120 }, (_, i) => ({ id: i, ts: 1_700_000_000_000 + i * 100, price: 100 + i, qty: 1, buy: i % 2 === 0 }));

describe("live lead promotion", () => {
  it("wash/churn leads become wash-trading cases, bursts become pump cases", () => {
    expect(patternForAlerts([{ kind: "churn" }])).toBe("wash_trading");
    expect(patternForAlerts([{ kind: "burst" }, { kind: "pressure" }])).toBe("coordinated_pump");
  });
  it("freezes every tick with venue, time window and anonymous roles", () => {
    const sc = liveToScenario(buf, [{ kind: "wash", label: "Repeated lots" }], "btc", "Coinbase", Date.UTC(2026, 10, 18, 9, 5, 7));
    expect(sc.caseRef).toBe("PF-LIVE-20261118-090507");
    expect(sc.trades).toHaveLength(120);
    expect(sc.start).toBe(buf[0]!.ts);
    expect(sc.end).toBe(buf[119]!.ts);
    expect(sc.trades[0]!.buyer).toBe(ANON_TAKER);
    expect(sc.venue.name).toBe("Coinbase");
    expect(sc.live?.tickCount).toBe(120);
  });
  it("refuses an empty buffer", () => {
    expect(() => liveToScenario([], [], "btc", "Kraken", 0)).toThrow();
  });
  it("case ref is UTC-based", () => expect(liveCaseRef(Date.UTC(2026, 0, 2, 3, 4, 5))).toBe("PF-LIVE-20260102-030405"));
});

describe("enforcement dossiers", () => {
  it("every dossier cites at least one official source", () => {
    for (const d of DOSSIERS) expect(d.law.length).toBeGreaterThan(0);
  });
});
