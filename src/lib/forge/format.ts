import type { CaseStatus, PatternType, Role } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/** All timestamps render in UTC so server and browser output match. */
export function fmtTs(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}
export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
export function fmtHm(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${pad(m % 60)}m`;
}
export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(a < 10 ? 2 : 0);
}
export function fmtPrice(p: number): string {
  if (p === 0) return "0";
  if (p < 0.001) return p.toPrecision(4);
  if (p < 1) return p.toFixed(5);
  return p.toFixed(3);
}
export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export function shortAddr(a: string): string {
  if (a.startsWith("acct-")) return a;
  if (a.length <= 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export const PATTERN_LABEL: Record<PatternType, string> = {
  wash_trading: "Wash trading",
  spoofing: "Spoofing / layering",
  coordinated_pump: "Coordinated pump",
};
export const PATTERN_CODE: Record<PatternType, string> = {
  wash_trading: "WASH",
  spoofing: "SPOOF",
  coordinated_pump: "PUMP",
};
export const STATUS_LABEL: Record<CaseStatus, string> = {
  new: "New",
  under_review: "Under review",
  escalated: "Escalated",
  dismissed: "Dismissed",
};
export const ROLE_LABEL: Record<Role, string> = {
  analyst: "Analyst",
  compliance: "Compliance",
  admin: "Admin",
};
