import { useMemo, useState } from "react";

import { fmtCompact, shortAddr } from "@/lib/forge/format";
import type { Detection, WalletNode } from "@/lib/forge/types";
import { cn } from "@/lib/utils";

const W = 760;
const H = 440;
const CX = W / 2;
const CY = H / 2 + 20;

export function WalletGraph({ d }: { d: Detection }) {
  const [selected, setSelected] = useState<string | null>(null);
  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    const subjects = d.graph.nodes.filter((n) => n.role === "subject");
    const funders = d.graph.nodes.filter((n) => n.role === "funder");
    const others = d.graph.nodes.filter((n) => n.role === "counterparty" || n.role === "pool");
    const r1 = subjects.length === 1 ? 0 : Math.min(130, 50 + subjects.length * 14);
    subjects.forEach((n, i) => {
      const a = (i / subjects.length) * Math.PI * 2 - Math.PI / 2 + 0.3;
      pos.set(n.id, { x: CX + r1 * Math.cos(a), y: CY + r1 * 0.78 * Math.sin(a) });
    });
    funders.forEach((n, i) => pos.set(n.id, { x: CX + (i - (funders.length - 1) / 2) * 140, y: 42 }));
    // place counterparties left/right for readability
    others.forEach((n, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(i / 2);
      pos.set(n.id, { x: CX + side * (subjects.length === 1 ? 250 : 320), y: CY - 60 + row * 70 });
    });
    if (others.length === 1) pos.set(others[0].id, { x: CX, y: H - 34 });
    const maxVol = Math.max(1, ...d.graph.nodes.map((n) => n.buyVolume + n.sellVolume));
    const edges = new Map<string, { a: string; b: string; value: number; count: number; kind: "funding" | "trade" }>();
    for (const e of d.graph.edges) {
      const [a, b] = [e.from, e.to].sort();
      const k = `${e.kind}:${a}:${b}`;
      const x = edges.get(k) ?? { a, b, value: 0, count: 0, kind: e.kind };
      x.value += e.value;
      x.count += e.count;
      edges.set(k, x);
    }
    const maxEdge = Math.max(1, ...[...edges.values()].filter((e) => e.kind === "trade").map((e) => e.value));
    return { pos, maxVol, edges: [...edges.values()], maxEdge };
  }, [d]);

  const subjectSet = new Set(d.wallets);
  const sel = d.graph.nodes.find((n) => n.id === selected) ?? null;
  const radius = (n: WalletNode) => (n.role === "funder" ? 9 : n.role === "pool" ? 14 : 6 + 14 * Math.sqrt((n.buyVolume + n.sellVolume) / layout.maxVol));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="overflow-hidden rounded border border-border bg-panel bg-terminal-grid">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Wallet cluster graph">
          {layout.edges.map((e, i) => {
            const a = layout.pos.get(e.a);
            const b = layout.pos.get(e.b);
            if (!a || !b) return null;
            const internal = subjectSet.has(e.a) && subjectSet.has(e.b);
            const hl = selected && (e.a === selected || e.b === selected);
            if (e.kind === "funding")
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--primary)" strokeOpacity={hl ? 0.95 : 0.55} strokeDasharray="4 4" strokeWidth={1.2} />;
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={internal ? "var(--alert)" : "var(--muted-foreground)"}
                strokeOpacity={hl ? 0.95 : internal ? 0.7 : 0.25}
                strokeWidth={1 + 5 * Math.sqrt(e.value / layout.maxEdge)}>
                <title>{`${e.count} trades · ${fmtCompact(e.value)} ${d.pair.split("/")[0]}`}</title>
              </line>
            );
          })}
          {d.graph.nodes.map((n) => {
            const p = layout.pos.get(n.id);
            if (!p) return null;
            const r = radius(n);
            const color = n.role === "subject" ? "var(--alert)" : n.role === "funder" ? "var(--primary)" : n.role === "pool" ? "var(--success)" : "var(--muted-foreground)";
            return (
              <g key={n.id} className="cursor-pointer" onClick={() => setSelected(n.id === selected ? null : n.id)}>
                <title>{n.label ?? n.id}</title>
                {selected === n.id && <circle cx={p.x} cy={p.y} r={r + 6} fill="none" stroke={color} strokeOpacity={0.6} />}
                <circle cx={p.x} cy={p.y} r={r} fill={color} fillOpacity={n.role === "counterparty" ? 0.25 : 0.2} stroke={color} strokeWidth={1.5} />
                <text x={p.x} y={p.y + r + 13} textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)" fill="var(--foreground)" fillOpacity={0.8}>
                  {shortAddr(n.id)}
                </text>
                {n.label && (
                  <text x={p.x} y={p.y + r + 25} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">{n.label}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="space-y-3 text-xs">
        <div className="space-y-1.5 rounded border border-border p-3">
          <div className="label-caps mb-1">Legend</div>
          <Legend color="bg-alert" label="Subject wallet / account" />
          <Legend color="bg-primary" label="Funding source" />
          <Legend color="bg-success" label="Liquidity pool" />
          <Legend color="bg-muted-foreground" label="Top counterparty" />
          <div className="flex items-center gap-2 pt-1 text-muted-foreground"><span className="w-5 border-t border-dashed border-primary" /> Funding transfer</div>
          <div className="flex items-center gap-2 text-muted-foreground"><span className="w-5 border-t-2 border-alert" /> Trades within cluster</div>
        </div>
        <div className={cn("rounded border p-3", sel ? "border-primary/40" : "border-border")}>
          {sel ? (
            <div className="space-y-1.5">
              <div className="label-caps">{sel.role}</div>
              <div className="break-all font-mono text-[11px]">{sel.id}</div>
              {sel.label && <div className="text-muted-foreground">{sel.label}</div>}
              {sel.role !== "funder" && (
                <dl className="grid grid-cols-2 gap-y-1 pt-1 font-mono">
                  <dt className="text-muted-foreground">Bought</dt><dd className="text-right">{fmtCompact(sel.buyVolume)}</dd>
                  <dt className="text-muted-foreground">Sold</dt><dd className="text-right">{fmtCompact(sel.sellVolume)}</dd>
                  <dt className="text-muted-foreground">Trades</dt><dd className="text-right">{sel.tradeCount}</dd>
                </dl>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Select a node to inspect its activity.</p>
          )}
        </div>
        {d.clusters.map((c) => (
          <div key={c.id} className="rounded border border-border p-3">
            <div className="label-caps">Cluster {c.id}</div>
            <p className="mt-1 text-muted-foreground">{c.basis}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className={cn("h-2.5 w-2.5 rounded-full opacity-80", color)} /> {label}
    </div>
  );
}
