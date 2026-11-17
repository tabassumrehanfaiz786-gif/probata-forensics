import { describe, expect, it } from "vitest";
import { nextExchange, EXCHANGES } from "@/lib/forge/exchanges";

describe("exchange fallback", () => {
  it("tries Binance first then Coinbase and Kraken, and wraps around", () => {
    expect(EXCHANGES.map((e) => e.id)).toEqual(["binance", "binance-vision", "coinbase", "kraken"]);
    expect(nextExchange(3)).toBe(0);
  });
  it("Coinbase maker side sell is a taker buy", () => {
    const t = EXCHANGES[2].parse(JSON.stringify({ type: "match", trade_id: 1, time: "2026-01-01T00:00:00Z", price: "10", size: "2", side: "sell" }));
    expect(t[0].buy).toBe(true);
  });
});
