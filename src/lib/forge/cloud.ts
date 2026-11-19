// Team workspace persistence in Lovable Cloud. Identity, role and timestamps on audit rows
// are stamped by the database, so the browser cannot forge who did what.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

import type { AuditEntry, CaseStatus, Role, Scenario } from "./types";

type AuditRow = Database["public"]["Tables"]["audit_log"]["Row"];
type StateRow = Database["public"]["Tables"]["case_states"]["Row"];

export interface TeamSnapshot {
  role: Role;
  statuses: Record<string, CaseStatus>;
  narratives: Record<string, string>;
  liveCases: Scenario[];
  audit: AuditEntry[];
}

export function auditFromRow(r: AuditRow): AuditEntry {
  return { id: r.id, ts: Date.parse(r.ts), role: (r.role ?? "analyst") as Role, action: r.action, target: r.target, detail: r.detail, actor: r.actor ?? undefined };
}

export function statesFromRows(rows: StateRow[]) {
  const statuses: Record<string, CaseStatus> = {};
  const narratives: Record<string, string> = {};
  for (const r of rows) {
    if (r.status) statuses[r.case_ref] = r.status;
    if (r.narrative_marc != null) narratives[`${r.case_ref}:MARC`] = r.narrative_marc;
    if (r.narrative_mica != null) narratives[`${r.case_ref}:MiCA`] = r.narrative_mica;
  }
  return { statuses, narratives };
}

const ROLE_RANK: Record<Role, number> = { analyst: 1, compliance: 2, admin: 3 };
export function topRole(roles: Role[]): Role {
  return roles.reduce<Role>((best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best), "analyst");
}

export async function loadTeam(userId: string): Promise<TeamSnapshot> {
  const [roles, states, live, audit] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("case_states").select("*"),
    supabase.from("live_cases").select("scenario").order("created_at", { ascending: false }).limit(50),
    supabase.from("audit_log").select("*").order("ts", { ascending: false }).limit(1000),
  ]);
  const err = roles.error ?? states.error ?? live.error ?? audit.error;
  if (err) throw err;
  return {
    role: topRole((roles.data ?? []).map((r) => r.role as Role)),
    ...statesFromRows(states.data ?? []),
    liveCases: (live.data ?? []).map((r) => r.scenario as unknown as Scenario),
    audit: (audit.data ?? []).map(auditFromRow),
  };
}

async function must<T extends { error: unknown }>(p: PromiseLike<T>) {
  const r = await p;
  if (r.error) throw r.error;
  return r;
}

export const saveStatus = (caseRef: string, status: CaseStatus) =>
  must(supabase.from("case_states").upsert({ case_ref: caseRef, status }, { onConflict: "case_ref" }));

export const saveNarrative = (caseRef: string, regime: "MARC" | "MiCA", text: string | null) =>
  must(supabase.from("case_states").upsert(regime === "MARC" ? { case_ref: caseRef, narrative_marc: text } : { case_ref: caseRef, narrative_mica: text }, { onConflict: "case_ref" }));

export const saveLiveCase = (sc: Scenario) =>
  must(supabase.from("live_cases").insert({ case_ref: sc.caseRef, scenario: sc as unknown as Database["public"]["Tables"]["live_cases"]["Insert"]["scenario"] }));

/** user_id, role, actor and ts are overwritten by a database trigger. */
export const appendAudit = (userId: string, action: string, target: string, detail: string) =>
  must(supabase.from("audit_log").insert({ user_id: userId, action, target, detail }));
