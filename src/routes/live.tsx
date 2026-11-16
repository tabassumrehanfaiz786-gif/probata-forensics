import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Radio } from "lucide-react";

import { BUFFER_SIZE, computeMetrics, DEFAULT_LIVE_THRESHOLDS, liveAlerts, pushTick, type LiveAlert, type LiveTick } from "@/lib/forge/live-metrics";
import { fmtTime } from "@/lib/forge/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live Tape Surveillance · Probata Forensics" },
      { name: "description", content: "Real-time Binance trade buffer with rolling wash, burst, churn and pressure indicators mapped to UK MAR and MiCA." },
      { property: "og:title", content: "Live Tape Surveillance · Probata Forensics" },
      { property: "og:description", content: "Rolling 500-tick live market-abuse indicators on public exchange data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LivePage,
});

const SYMBOLS = ["btcusdt", "ethusdt", "solusdt", "dogeusdt", "pepeusdt"];
interface Logged extends LiveAlert { ts: number; symbol: string }

function LivePage() {
  const [symbol, setSymbol] = useState("btcusdt");
  const [buf, setBuf] = useState<LiveTick[]>([]);
  const [state, setState] = useState<"connecting" | "live" | "offline">("connecting");
  const [log, setLog] = useState<Logged[]>([]);
  const pending = useRef<LiveTick[]>([]);

  useEffect(() => {
    setBuf([]); setState("connecting"); pending.current = [];
    let closed = false;
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@aggTrade`);
    ws.onopen = () => setState("live");
    ws.onerror = () => setState("offline");
    ws.onclose = () => { if (!closed) setState("offline"); };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data as string) as { a: number; T: number; p: string; q: string; m: boolean };
      pending.current.push({ id: m.a, ts: m.T, price: +m.p, qty: +m.q, buy: !m.m });
    };
    const iv = setInterval(() => {
      if (!pending.current.length) return;
      const batch = pending.current; pending.current = [];
      setBuf((b) => batch.reduce((acc, t) => pushTick(acc, t), b));
    }, 500);
    return () => { closed = true; clearInterval(iv); ws.close(); };
  }, [symbol]);

  const metrics = useMemo(() => computeMetrics(buf), [buf]);
  const alerts = useMemo(() => liveAlerts(metrics), [metrics]);
  const lastKinds = useRef("");
  useEffect(() => {
    const k = alerts.map((a) => a.kind).join(",");
    if (k && k !== lastKinds.current) setLog((l) => [...alerts.map((a) => ({ ...a, ts: Date.now(), symbol })), ...l].slice(0, 30));
    lastKinds.current = k;
  }, [alerts, symbol]);

  const th = DEFAULT_LIVE_THRESHOLDS;
  const cards = [
    { k: "Repeated lot share", v: `${(metrics.repeatShare * 100).toFixed(1)}%`, t: `≥ ${th.repeatShare * 100}%`, hot: metrics.repeatShare >= th.repeatShare, s: metrics.topLot ? `top lot ${metrics.topLot}` : "—" },
    { k: "Velocity burst (z)", v: metrics.burstZ.toFixed(2), t: `≥ ${th.burstZ}`, hot: metrics.burstZ >= th.burstZ, s: `${metrics.tradesPerSec.toFixed(1)} trades/s` },
    { k: "Churn / volatility", v: metrics.churnRatio.toFixed(2), t: `≥ ${th.churnRatio}`, hot: metrics.churnRatio >= th.churnRatio, s: `vol ${metrics.volume.toFixed(3)}` },
    { k: "Aggressor imbalance", v: `${(metrics.imbalance * 100).toFixed(0)}%`, t: `≥ ${th.imbalance * 100}%`, hot: metrics.imbalance >= th.imbalance, s: "buy vs sell volume" },
  ];
  const recent = buf.slice(-14).reverse();
  const prices = buf.map((t) => t.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const spark = prices.map((p, i) => `${(i / Math.max(1, prices.length - 1)) * 100},${hi === lo ? 50 : 100 - ((p - lo) / (hi - lo)) * 100}`).join(" ");

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-primary"><Radio className="h-3.5 w-3.5" />Engine A · live public tape</div>
          <h1 className="mt-1 text-2xl font-semibold">Live Tape Surveillance</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Rolling {BUFFER_SIZE}-tick buffer from Binance. Indicators are investigative leads — public trades carry no account identity, so they cannot prove beneficial ownership or intent.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SYMBOLS.map((s) => (
            <button key={s} onClick={() => setSymbol(s)} className={cn("rounded-md border px-3 py-1.5 font-mono text-xs uppercase", s === symbol ? "border-primary text-primary" : "border-border text-muted-foreground")}>{s.replace("usdt", "/usdt")}</button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-xs">
        <span className={cn("h-2 w-2 rounded-full", state === "live" ? "animate-pulse-dot bg-success" : state === "connecting" ? "bg-alert" : "bg-muted-foreground")} />
        <span className="font-mono">{state.toUpperCase()}</span>
        <span className="text-muted-foreground">Buffer {metrics.n}/{BUFFER_SIZE}</span>
        {metrics.n < 50 && state === "live" && <span className="text-muted-foreground">Warming up — alerts start at 50 ticks</span>}
        {state === "offline" && <span className="text-muted-foreground">Stream unreachable from this network.</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.k} className={cn("rounded-lg border bg-card p-4", c.hot ? "border-destructive" : "border-border")}>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{c.k}</div>
            <div className={cn("mt-1 text-2xl font-semibold tabular-nums", c.hot && "text-destructive")}>{c.v}</div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground"><span>{c.s}</span><span>alert {c.t}</span></div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
          <div className="mb-2 flex justify-between font-mono text-[10px] uppercase text-muted-foreground"><span>Price · window</span><span>{prices.length ? `${lo} – ${hi}` : ""}</span></div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-40 w-full">
            {prices.length > 1 && <polyline points={spark} fill="none" stroke="var(--primary)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />}
          </svg>
          <table className="mt-3 w-full font-mono text-[11px] tabular-nums">
            <tbody>
              {recent.map((t) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="py-1 text-muted-foreground">{fmtTime(t.ts)}</td>
                  <td className={cn("py-1 text-right", t.buy ? "text-primary" : "text-alert")}>{t.price}</td>
                  <td className="py-1 text-right">{t.qty}</td>
                  <td className="py-1 text-right text-muted-foreground">{t.buy ? "BUY" : "SELL"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />Lead log</div>
          {log.length === 0 && <p className="text-xs text-muted-foreground">No thresholds crossed yet.</p>}
          <ul className="space-y-2">
            {log.map((a, i) => (
              <li key={i} className="rounded border border-border p-2 text-xs">
                <div className="flex justify-between"><span className="font-medium">{a.label}</span><span className="font-mono text-destructive">{a.value}</span></div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{fmtTime(a.ts)} · {a.symbol.toUpperCase()} · {a.statute}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
