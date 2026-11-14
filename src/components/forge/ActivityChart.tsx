import { Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { fmtCompact, fmtHm, fmtPrice } from "@/lib/forge/format";
import type { Detection } from "@/lib/forge/types";

export function ActivityChart({ d, height = 280 }: { d: Detection; height?: number }) {
  const data = d.series.map((p) => ({ t: p.t, price: p.price, flagged: p.flagged, other: Math.max(0, p.volume - p.flagged) }));
  const step = d.series[1] ? d.series[1].t - d.series[0].t : 300_000;
  const x1 = Math.floor(d.window.start / step) * step;
  const x2 = Math.floor(d.window.end / step) * step;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="t" tickFormatter={fmtHm} stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} minTickGap={40} />
          <YAxis yAxisId="v" tickFormatter={fmtCompact} stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={44} />
          <YAxis yAxisId="p" orientation="right" tickFormatter={fmtPrice} stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} width={64} domain={["auto", "auto"]} />
          <ReferenceArea yAxisId="v" x1={x1} x2={x2} fill="var(--alert)" fillOpacity={0.07} stroke="var(--alert)" strokeOpacity={0.35} strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}
            labelFormatter={(t) => `${fmtHm(Number(t))} UTC`}
            formatter={(v: number, name: string) => [name === "price" ? fmtPrice(v) : fmtCompact(v), name === "price" ? "Price" : name === "flagged" ? "Flagged volume" : "Other volume"]}
          />
          <Bar yAxisId="v" dataKey="other" stackId="v" fill="var(--chart-4)" fillOpacity={0.45} isAnimationActive={false} />
          <Bar yAxisId="v" dataKey="flagged" stackId="v" fill="var(--alert)" isAnimationActive={false} />
          <Line yAxisId="p" dataKey="price" stroke="var(--primary)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
