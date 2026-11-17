import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { EXCHANGES, nextExchange, type Base } from "./exchanges";
import { computeMetrics, liveAlerts, pushTick, type LiveAlert, type LiveMetrics, type LiveTick } from "./live-metrics";

export type StreamState = "connecting" | "live" | "failover";
export interface LoggedAlert extends LiveAlert { ts: number; symbol: string; venue: string }

interface LiveCtx {
  base: Base; setBase: (b: Base) => void;
  buf: LiveTick[]; metrics: LiveMetrics; alerts: LiveAlert[]; log: LoggedAlert[];
  state: StreamState; venue: string; attempts: string[]; rate: number;
}
const Ctx = createContext<LiveCtx | null>(null);
const FAIL_MS = 5000;

/** App-wide live engine: stays connected across pages and fails over between public exchanges. */
export function LiveStreamProvider({ children }: { children: ReactNode }) {
  const [base, setBase] = useState<Base>("btc");
  const [buf, setBuf] = useState<LiveTick[]>([]);
  const [state, setState] = useState<StreamState>("connecting");
  const [venue, setVenue] = useState(EXCHANGES[0]!.label);
  const [attempts, setAttempts] = useState<string[]>([]);
  const [log, setLog] = useState<LoggedAlert[]>([]);
  const [rate, setRate] = useState(0);
  const pending = useRef<LiveTick[]>([]);
  const count = useRef(0);

  useEffect(() => {
    let idx = 0, ws: WebSocket | null = null, timer: ReturnType<typeof setTimeout> | undefined, stopped = false;
    setBuf([]); pending.current = []; setAttempts([]);
    const connect = () => {
      if (stopped) return;
      const ex = EXCHANGES[idx]!;
      setVenue(ex.label); setState((s) => (s === "live" ? "failover" : s === "failover" ? "failover" : "connecting"));
      let gotTick = false;
      const fail = (why: string) => {
        if (stopped || ws === null) return;
        const dead = ws; ws = null; dead.onclose = null; try { dead.close(); } catch { /* ignore */ }
        clearTimeout(timer);
        setAttempts((a) => [`${ex.label}: ${why}`, ...a].slice(0, 6));
        setState("failover");
        idx = nextExchange(idx);
        timer = setTimeout(connect, 600);
      };
      try { ws = new WebSocket(ex.url(base)); } catch { ws = {} as WebSocket; fail("blocked"); return; }
      const sock = ws;
      timer = setTimeout(() => { if (!gotTick) fail("no trades in 5s"); }, FAIL_MS);
      sock.onopen = () => { if (ex.subscribe) sock.send(ex.subscribe(base)); };
      sock.onerror = () => fail("connection refused");
      sock.onclose = () => fail("disconnected");
      sock.onmessage = (ev) => {
        let ticks: LiveTick[] = [];
        try { ticks = ex.parse(ev.data as string); } catch { return; }
        if (!ticks.length) return;
        if (!gotTick) { gotTick = true; clearTimeout(timer); setState("live"); }
        count.current += ticks.length;
        pending.current.push(...ticks);
      };
    };
    connect();
    const flush = setInterval(() => {
      if (!pending.current.length) return;
      const batch = pending.current; pending.current = [];
      setBuf((b) => batch.reduce((acc, t) => pushTick(acc, t), b));
    }, 500);
    const rateIv = setInterval(() => { setRate(count.current * 6); count.current = 0; }, 10_000);
    return () => { stopped = true; clearTimeout(timer); clearInterval(flush); clearInterval(rateIv); if (ws) { ws.onclose = null; ws.close(); } };
  }, [base]);

  const metrics = useMemo(() => computeMetrics(buf), [buf]);
  const alerts = useMemo(() => liveAlerts(metrics), [metrics]);
  const lastKinds = useRef("");
  useEffect(() => {
    const k = alerts.map((a) => a.kind).join(",");
    if (k && k !== lastKinds.current) {
      const now = Date.now();
      setLog((l) => [...alerts.map((a) => ({ ...a, ts: now, symbol: base, venue })), ...l].slice(0, 50));
      toast.warning(`Live lead · ${base.toUpperCase()} on ${venue}`, { description: alerts.map((a) => a.label).join(", ") });
    }
    lastKinds.current = k;
  }, [alerts, base, venue]);

  const value = { base, setBase, buf, metrics, alerts, log, state, venue, attempts, rate };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiveStream() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLiveStream must be inside LiveStreamProvider");
  return c;
}
