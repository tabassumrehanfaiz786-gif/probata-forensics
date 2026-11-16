import { describe, expect, it } from "vitest";
import { computeMetrics, liveAlerts, pushTick, type LiveTick } from "@/lib/forge/live-metrics";

const mk = (i: number, o: Partial<LiveTick> = {}): LiveTick => ({ id: i, ts: 1000 + i * 100, price: 100 + (i % 7) * 0.01, qty: 0.001 * (1 + (i % 13)), buy: i % 2 === 0, ...o });

describe("live tick buffer", () => {
  it("keeps at most 500 ticks", () => {
    let b: LiveTick[] = [];
    for (let i = 0; i < 520; i++) b = pushTick(b, mk(i));
    expect(b.length).toBe(500);
    expect(b[0]!.id).toBe(20);
  });
  it("flags repeated identical lots when they reach 25% of the window", () => {
    const b = Array.from({ length: 100 }, (_, i) => mk(i, i < 30 ? { qty: 0.5 } : {}));
    expect(liveAlerts(computeMetrics(b)).some((a) => a.kind === "wash")).toBe(true);
  });
  it("raises no alerts under 50 ticks", () => {
    const b = Array.from({ length: 49 }, (_, i) => mk(i, { qty: 0.5, buy: true }));
    expect(liveAlerts(computeMetrics(b))).toEqual([]);
  });
});
