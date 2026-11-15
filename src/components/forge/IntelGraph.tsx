import { useMemo, useState } from "react";
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Handle, Position, BaseEdge, getBezierPath,
  ReactFlowProvider, type Node, type Edge, type NodeProps, type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeftRight, Building2, Crosshair, Droplets, Search, Shuffle, Users, Wallet, X, Megaphone } from "lucide-react";
import { buildIntel, CHAINS, type FlowKind, type IntelCategory, type IntelEntity } from "@/lib/forge/intel-data";

const CAT: Record<IntelCategory, { color: string; icon: typeof Wallet; name: string }> = {
  primary: { color: "var(--intel-amber)", icon: Crosshair, name: "Primary target" },
  coordinator: { color: "var(--intel-red)", icon: Megaphone, name: "Coordinator" },
  cluster: { color: "var(--intel-violet)", icon: Users, name: "Sybil cluster" },
  mixer: { color: "var(--intel-violet)", icon: Shuffle, name: "Mixer hop" },
  bridge: { color: "var(--intel-cyan)", icon: ArrowLeftRight, name: "Bridge" },
  exchange: { color: "var(--intel-cyan)", icon: Building2, name: "Exchange exit" },
  pool: { color: "var(--intel-green)", icon: Droplets, name: "DEX pool" },
  wallet: { color: "var(--intel-muted)", icon: Wallet, name: "Wallet" },
};
const FLOW: Record<FlowKind, { color: string; name: string }> = {
  wash: { color: "var(--intel-red)", name: "Wash / self-match" },
  funding: { color: "var(--intel-amber)", name: "Funding" },
  exit: { color: "var(--intel-cyan)", name: "Exit ramp" },
  bridge: { color: "var(--intel-violet)", name: "Cross-chain" },
};

type ND = IntelEntity & { dim: boolean };
type HubNode = Node<ND, "hub">;
type LeafNode = Node<ND, "leaf">;

const hidden = { opacity: 0, width: 1, height: 1, border: 0, minWidth: 0 };

function HubNodeView({ data, selected }: NodeProps<HubNode>) {
  const c = CAT[data.category];
  const Icon = c.icon;
  return (
    <div style={{ opacity: data.dim ? 0.18 : 1, transition: "opacity .3s" }} className="relative flex items-center gap-3">
      <Handle type="target" position={Position.Left} style={{ ...hidden, left: 36, top: 36 }} />
      <Handle type="source" position={Position.Right} style={{ ...hidden, left: 36, top: 36 }} />
      <div className="relative grid h-[72px] w-[72px] place-items-center">
        <span className="intel-ring absolute inset-0 rounded-full" style={{ boxShadow: `0 0 34px 6px color-mix(in oklab, ${c.color} 55%, transparent)`, border: `2px solid ${c.color}` }} />
        <span className="absolute inset-[7px] rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${c.color} 45%, var(--intel-bg)), var(--intel-bg))`, border: `1px solid color-mix(in oklab, ${c.color} 60%, transparent)` }} />
        <Icon className="relative h-7 w-7" style={{ color: c.color }} />
        <span className="absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold" style={{ background: c.color, color: "var(--intel-bg)" }}>{data.risk}</span>
      </div>
      <div className="rounded-md px-3 py-2 backdrop-blur-md" style={{ background: "var(--intel-panel)", border: `1px solid ${selected ? c.color : "color-mix(in oklab, " + c.color + " 40%, transparent)"}`, boxShadow: selected ? `0 0 24px color-mix(in oklab, ${c.color} 50%, transparent)` : "none" }}>
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest" style={{ color: c.color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />{c.name} · {data.chain}
        </div>
        <div className="mt-0.5 whitespace-nowrap text-[13px] font-semibold" style={{ color: "var(--intel-text)" }}>{data.label}</div>
        <div className="whitespace-nowrap text-[10px]" style={{ color: "var(--intel-muted)" }}>{data.subtitle}{data.amount ? ` · ${data.amount}` : ""}</div>
      </div>
    </div>
  );
}

function LeafNodeView({ data }: NodeProps<LeafNode>) {
  const hot = data.risk > 65;
  const col = hot ? "var(--intel-red)" : "var(--intel-cyan)";
  return (
    <div className="flex items-center gap-1" style={{ opacity: data.dim ? 0.1 : 0.9 }}>
      <Handle type="target" position={Position.Left} style={{ ...hidden, left: 4, top: 6 }} />
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />
      <span className="font-mono text-[8px]" style={{ color: "var(--intel-muted)" }}>{data.label}</span>
    </div>
  );
}

type ED = { kind: FlowKind; value: number; label?: string; dim: boolean; major: boolean };
function FlowEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<Edge<ED>>) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition: Position.Right, targetPosition: Position.Left, curvature: 0.25 });
  const d = data!;
  const col = FLOW[d.kind].color;
  const w = d.major ? Math.min(1.5 + d.value * 0.55, 6) : 0.6;
  const op = d.dim ? 0.06 : d.major ? 1 : 0.35;
  return (
    <g style={{ opacity: op, transition: "opacity .3s" }}>
      {d.major && <path d={path} fill="none" stroke={col} strokeWidth={w * 3.5} strokeOpacity={0.18} style={{ filter: "blur(4px)" }} />}
      <BaseEdge id={id} path={path} markerEnd={d.major ? `url(#arrow-${d.kind})` : undefined} style={{ stroke: col, strokeWidth: w }} />
      {d.major && (
        <>
          <path d={path} fill="none" stroke="var(--intel-text)" strokeWidth={1.2} strokeDasharray="4 36" className="intel-dash" strokeOpacity={0.8} />
          {[0, 1, 2].map((i) => (
            <circle key={i} r={3} fill={col} style={{ filter: `drop-shadow(0 0 6px ${col})` }}>
              <animateMotion dur={`${3.2 - Math.min(d.value, 8) * 0.18}s`} begin={`${i * 1}s`} repeatCount="indefinite" path={path} />
            </circle>
          ))}
          {d.label && (
            <text dy={-6} className="font-mono" fontSize={10} fill={col}>
              <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{d.label} · ${d.value.toFixed(1)}M</textPath>
            </text>
          )}
        </>
      )}
    </g>
  );
}

const nodeTypes = { hub: HubNodeView, leaf: LeafNodeView };
const edgeTypes = { flow: FlowEdge };

function Inner() {
  const intel = useMemo(() => buildIntel(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [chains, setChains] = useState<Set<string>>(new Set(CHAINS));
  const [minRisk, setMinRisk] = useState(0);
  const [q, setQ] = useState("");
  const [showLeaves, setShowLeaves] = useState(true);

  const focus = useMemo(() => {
    if (!selected) return null;
    const s = new Set([selected]);
    intel.flows.forEach((f) => { if (f.from === selected) s.add(f.to); if (f.to === selected) s.add(f.from); });
    return s;
  }, [selected, intel]);

  const visible = (e: IntelEntity) => chains.has(e.chain) && e.risk >= minRisk && (showLeaves || e.category !== "wallet") && (!q || e.label.toLowerCase().includes(q.toLowerCase()));

  const nodes: Node<ND>[] = intel.entities.filter(visible).map((e) => ({
    id: e.id, type: e.category === "wallet" ? "leaf" : "hub", position: { x: e.x, y: e.y },
    data: { ...e, dim: !!focus && !focus.has(e.id) && !(e.hub && focus.has(e.hub) && e.hub === selected) },
    draggable: true,
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge<ED>[] = intel.flows.filter((f) => ids.has(f.from) && ids.has(f.to)).map((f) => ({
    id: f.id, source: f.from, target: f.to, type: "flow",
    data: { kind: f.kind, value: f.value, label: f.label, major: !f.id.includes("-w"), dim: !!focus && f.from !== selected && f.to !== selected },
  }));

  const sel = intel.entities.find((e) => e.id === selected);
  const selFlows = intel.flows.filter((f) => !f.id.includes("-w") && (f.from === selected || f.to === selected));
  const name = (id: string) => intel.entities.find((e) => e.id === id)?.label ?? id;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 45%, color-mix(in oklab, var(--intel-amber) 12%, var(--intel-bg)) 0%, var(--intel-bg) 55%)" }}>
      <svg width="0" height="0" className="absolute">
        <defs>
          {(Object.keys(FLOW) as FlowKind[]).map((k) => (
            <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={FLOW[k].color} />
            </marker>
          ))}
        </defs>
      </svg>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.15} maxZoom={2.5}
        onNodeClick={(_, n) => setSelected(n.type === "leaf" ? (n.data as unknown as ND).hub ?? n.id : n.id)} onPaneClick={() => setSelected(null)} proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.2} color="var(--intel-line)" />
        <Controls position="bottom-left" style={{ background: "var(--intel-panel)" }} />
        <MiniMap pannable zoomable position="bottom-right" style={{ background: "var(--intel-panel)", border: "1px solid var(--intel-line)" }} maskColor="color-mix(in oklab, var(--intel-bg) 70%, transparent)"
          nodeColor={(n) => CAT[(n.data as unknown as ND).category].color} nodeStrokeWidth={0} />
      </ReactFlow>

      {/* Control bar */}
      <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-2 rounded-lg p-2 backdrop-blur-md" style={{ background: "var(--intel-panel)", border: "1px solid var(--intel-line)", color: "var(--intel-text)" }}>
        <div className="flex items-center gap-2 rounded px-2 py-1" style={{ border: "1px solid var(--intel-line)" }}>
          <Search className="h-3.5 w-3.5" style={{ color: "var(--intel-muted)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entity / address" className="w-40 bg-transparent text-xs outline-none" />
        </div>
        {CHAINS.map((c) => {
          const on = chains.has(c);
          return (
            <button key={c} onClick={() => setChains((s) => { const n = new Set(s); on ? n.delete(c) : n.add(c); return n; })}
              className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition"
              style={{ border: `1px solid ${on ? "var(--intel-amber)" : "var(--intel-line)"}`, color: on ? "var(--intel-amber)" : "var(--intel-muted)" }}>{c}</button>
          );
        })}
        <label className="flex items-center gap-2 font-mono text-[10px] uppercase" style={{ color: "var(--intel-muted)" }}>
          Risk ≥ {minRisk}
          <input type="range" min={0} max={90} value={minRisk} onChange={(e) => setMinRisk(+e.target.value)} className="w-24 accent-[var(--intel-amber)]" />
        </label>
        <button onClick={() => setShowLeaves((v) => !v)} className="rounded px-2 py-1 font-mono text-[10px] uppercase" style={{ border: "1px solid var(--intel-line)", color: "var(--intel-muted)" }}>
          {showLeaves ? "Hide" : "Show"} wallets
        </button>
        <div className="ml-auto hidden items-center gap-3 lg:flex">
          {(Object.keys(FLOW) as FlowKind[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--intel-muted)" }}>
              <span className="h-0.5 w-5 rounded" style={{ background: FLOW[k].color, boxShadow: `0 0 6px ${FLOW[k].color}` }} />{FLOW[k].name}
            </span>
          ))}
        </div>
      </div>

      {/* HUD */}
      {sel && (
        <div className="absolute right-3 top-20 w-80 max-w-[calc(100%-1.5rem)] rounded-lg p-4 backdrop-blur-md" style={{ background: "var(--intel-panel)", border: `1px solid ${CAT[sel.category].color}`, boxShadow: `0 0 40px color-mix(in oklab, ${CAT[sel.category].color} 25%, transparent)`, color: "var(--intel-text)" }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: CAT[sel.category].color }}>{CAT[sel.category].name} · {sel.chain}</div>
              <div className="mt-1 text-base font-semibold">{sel.label}</div>
              <div className="text-xs" style={{ color: "var(--intel-muted)" }}>{sel.subtitle}</div>
            </div>
            <button onClick={() => setSelected(null)} aria-label="Close"><X className="h-4 w-4" style={{ color: "var(--intel-muted)" }} /></button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded p-2" style={{ border: "1px solid var(--intel-line)" }}>
              <div className="font-mono text-[9px] uppercase" style={{ color: "var(--intel-muted)" }}>Risk score</div>
              <div className="text-xl font-bold" style={{ color: CAT[sel.category].color }}>{sel.risk}<span className="text-xs">/100</span></div>
            </div>
            <div className="rounded p-2" style={{ border: "1px solid var(--intel-line)" }}>
              <div className="font-mono text-[9px] uppercase" style={{ color: "var(--intel-muted)" }}>Exposure</div>
              <div className="text-xl font-bold">{sel.amount ?? "—"}</div>
            </div>
          </div>
          {sel.note && <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--intel-muted)" }}>{sel.note}</p>}
          {selFlows.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--intel-muted)" }}>Linked flows</div>
              {selFlows.map((f) => (
                <button key={f.id} onClick={() => setSelected(f.from === selected ? f.to : f.from)} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[11px]" style={{ border: "1px solid var(--intel-line)" }}>
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: FLOW[f.kind].color }} />{f.from === selected ? "→ " + name(f.to) : "← " + name(f.from)}</span>
                  <span className="font-mono" style={{ color: FLOW[f.kind].color }}>${f.value.toFixed(1)}M · {f.hops}h</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 font-mono text-[9px]" style={{ color: "var(--intel-muted)" }}>Fictional replay entities · UK MAR Art. 12 / MiCA Art. 91 indicators</p>
        </div>
      )}
    </div>
  );
}

export default function IntelGraph() {
  return <ReactFlowProvider><Inner /></ReactFlowProvider>;
}
