import { useEffect, useRef, useState } from "react";

import { fmtTime } from "@/lib/forge/format";
import { cn } from "@/lib/utils";

interface Tick { id: number; ts: number; price: number; qty: number; buy: boolean }

/** Public Binance trade stream — shows the live ingestion path; detections still run on the replay set. */
export function LiveFeed() {
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [state, setState] = useState<"connecting" | "live" | "offline">("connecting");
  const count = useRef(0);
  const [rate, setRate] = useState(0);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    const timeout = setTimeout(() => { if (!closed) setState((s) => (s === "connecting" ? "offline" : s)); }, 8000);
    try {
      ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@aggTrade");
      ws.onopen = () => setState("live");
      ws.onerror = () => setState("offline");
      ws.onclose = () => { if (!closed) setState("offline"); };
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data as string) as { a: number; T: number; p: string; q: string; m: boolean };
        count.current++;
        setTicks((t) => [{ id: m.a, ts: m.T, price: Number(m.p), qty: Number(m.q), buy: !m.m }, ...t].slice(0, 9));
      };
    } catch {
      setState("offline");
    }
    const iv = setInterval(() => { setRate(count.current * 6); count.current = 0; }, 10_000);
    return () => { closed = true; clearTimeout(timeout); clearInterval(iv); ws?.close(); };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className={cn("h-2 w-2 rounded-full", state === "live" ? "animate-pulse-dot bg-success" : state === "connecting" ? "bg-alert" : "bg-muted-foreground")} />
        <span className="font-mono">BTC/USDT · Binance</span>
        <span className="ml-auto font-mono text-muted-foreground">{state === "live" ? `${rate || "…"} trades/min` : state}</span>
      </div>
      {state === "offline" ? (
        <p className="text-xs text-muted-foreground">Live stream unreachable from this browser. Detections continue to run on the replay dataset.</p>
      ) : (
        <table className="w-full font-mono text-[11px] tabular-nums">
          <tbody>
            {ticks.map((t) => (
              <tr key={t.id} className="border-b border-border/50 last:border-0">
                <td className="py-1 text-muted-foreground">{fmtTime(t.ts)}</td>
                <td className={cn("py-1 text-right", t.buy ? "text-primary" : "text-alert")}>{t.price.toFixed(2)}</td>
                <td className="py-1 text-right text-foreground/80">{t.qty.toFixed(5)}</td>
              </tr>
            ))}
            {ticks.length === 0 && <tr><td className="py-2 text-muted-foreground">Waiting for trades…</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
