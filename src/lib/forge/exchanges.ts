// Public trade-stream adapters. Each returns a normalised tick or null for non-trade frames.
import type { LiveTick } from "./live-metrics";

export interface ExchangeAdapter {
  id: string;
  label: string;
  url: (base: string) => string;
  subscribe?: (base: string) => string;
  parse: (raw: string) => LiveTick[];
}

export const BASES = ["btc", "eth", "sol", "doge", "pepe"] as const;
export type Base = (typeof BASES)[number];

const binanceParse = (raw: string): LiveTick[] => {
  const m = JSON.parse(raw) as { e?: string; a: number; T: number; p: string; q: string; m: boolean };
  return m.e === "aggTrade" ? [{ id: m.a, ts: m.T, price: +m.p, qty: +m.q, buy: !m.m }] : [];
};

export const EXCHANGES: ExchangeAdapter[] = [
  { id: "binance", label: "Binance", url: (b) => `wss://stream.binance.com:9443/ws/${b}usdt@aggTrade`, parse: binanceParse },
  { id: "binance-vision", label: "Binance (market-data mirror)", url: (b) => `wss://data-stream.binance.vision/ws/${b}usdt@aggTrade`, parse: binanceParse },
  {
    id: "coinbase", label: "Coinbase", url: () => "wss://ws-feed.exchange.coinbase.com",
    subscribe: (b) => JSON.stringify({ type: "subscribe", product_ids: [`${b.toUpperCase()}-USD`], channels: ["matches"] }),
    parse: (raw) => {
      const m = JSON.parse(raw) as { type: string; trade_id: number; time: string; price: string; size: string; side: string };
      if (m.type !== "match" && m.type !== "last_match") return [];
      // Coinbase "side" is the maker side; a sell maker means the taker bought.
      return [{ id: m.trade_id, ts: Date.parse(m.time), price: +m.price, qty: +m.size, buy: m.side === "sell" }];
    },
  },
  {
    id: "kraken", label: "Kraken", url: () => "wss://ws.kraken.com/v2",
    subscribe: (b) => JSON.stringify({ method: "subscribe", params: { channel: "trade", symbol: [`${b === "btc" ? "BTC" : b.toUpperCase()}/USD`] } }),
    parse: (raw) => {
      const m = JSON.parse(raw) as { channel?: string; data?: { trade_id: number; timestamp: string; price: number; qty: number; side: string }[] };
      if (m.channel !== "trade" || !m.data) return [];
      return m.data.map((t) => ({ id: t.trade_id, ts: Date.parse(t.timestamp), price: t.price, qty: t.qty, buy: t.side === "buy" }));
    },
  },
];

/** Next adapter index after a failure; wraps so the engine keeps retrying forever. */
export const nextExchange = (i: number) => (i + 1) % EXCHANGES.length;
