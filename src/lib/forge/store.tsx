import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import { appendAudit, loadTeam, saveLiveCase, saveNarrative, saveStatus, type TeamSnapshot } from "./cloud";
import { ForgeContext } from "./context";
import { CONFIDENCE_CAP, runDetector } from "./detection";
import { buildEvidencePackage, type EvidencePackage } from "./evidence";
import { STATUS_LABEL } from "./format";
import type { Regime } from "./legal";
import { can, canSetStatus } from "./permissions";
import { getScenarios } from "./scenarios";
import { DEFAULT_SETTINGS, type AuditEntry, type CaseStatus, type Detection, type DetectionSettings, type Role, type Scenario } from "./types";

const KEY = "evidenceforge.state.v1";

interface Persisted {
  role: Role;
  statuses: Record<string, CaseStatus>;
  narratives: Record<string, string>;
  settings: DetectionSettings;
  audit: AuditEntry[];
  liveCases?: Scenario[];
}

const SEED_AUDIT: AuditEntry[] = [
  { id: "seed-1", ts: Date.UTC(2026, 10, 3, 19, 4), role: "analyst", action: "Status → Under review", target: "EF-2026-0139", detail: "Assigned to S. Lindqvist" },
  { id: "seed-2", ts: Date.UTC(2026, 10, 4, 11, 22), role: "compliance", action: "Status → Escalated", target: "EF-2026-0139", detail: "Referred to MLRO for STOR consideration" },
  { id: "seed-3", ts: Date.UTC(2026, 10, 3, 9, 40), role: "compliance", action: "Status → Dismissed", target: "EF-2026-0136", detail: "Token launch with public allocation; cohort linked to disclosed launch partners" },
  { id: "seed-4", ts: Date.UTC(2026, 10, 5, 14, 2), role: "analyst", action: "Status → Under review", target: "EF-2026-0144", detail: "Requested private order log from venue" },
  { id: "seed-5", ts: Date.UTC(2026, 10, 7, 13, 18), role: "analyst", action: "Status → Under review", target: "EF-2026-0147", detail: "KYC request drafted" },
];

const DEFAULT: Persisted = { role: "analyst", statuses: {}, narratives: {}, settings: DEFAULT_SETTINGS, audit: SEED_AUDIT };

export interface TeamUser { id: string; email: string | null }

interface Ctx {
  ready: boolean;
  /** "team" when signed in: cases and audit log are shared through Lovable Cloud. */
  mode: "demo" | "team";
  user: TeamUser | null;
  syncing: boolean;
  signOut: () => Promise<void>;
  role: Role;
  setRole: (r: Role) => void;
  settings: DetectionSettings;
  updateSettings: (s: DetectionSettings) => boolean;
  resetSettings: () => void;
  detections: Detection[];
  cases: Detection[];
  suppressed: Detection[];
  statusOf: (caseRef: string) => CaseStatus;
  setStatus: (caseRef: string, next: CaseStatus, note?: string) => boolean;
  narrativeOf: (caseRef: string, regime: Regime) => string | undefined;
  setNarrative: (caseRef: string, regime: Regime, text: string | null) => void;
  audit: AuditEntry[];
  log: (action: string, target: string, detail: string) => void;
  scenarioOf: (caseRef: string) => Scenario | undefined;
  buildPackage: (caseRef: string) => Promise<EvidencePackage | null>;
  promoteLive: (sc: Scenario) => void;
}


export function ForgeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(DEFAULT);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const [user, setUser] = useState<TeamUser | null>(null);
  const [team, setTeam] = useState<TeamSnapshot | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Persisted>;
        setState({ ...DEFAULT, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } });
      }
    } catch {
      /* ignore corrupt local state */
    }
    loaded.current = true;
    setReady(true);
  }, []);

  useEffect(() => {
    if (loaded.current) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  // Identity transitions only; token refreshes must not reload the team workspace.
  useEffect(() => {
    const apply = (u: { id: string; email?: string | null } | null | undefined) =>
      setUser((prev) => (prev?.id === u?.id ? prev : u ? { id: u.id, email: u.email ?? null } : null));
    void supabase.auth.getUser().then(({ data }) => apply(data.user));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") apply(session?.user);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      setTeam(await loadTeam(user.id));
    } catch (e) {
      toast.error("Could not load the team workspace", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSyncing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) { setTeam(null); return; }
    void reload();
    let t: ReturnType<typeof setTimeout> | undefined;
    const bump = () => { clearTimeout(t); t = setTimeout(() => void reload(), 400); };
    const ch = supabase
      .channel(`team-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "case_states" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_cases" }, bump)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_log" }, bump)
      .subscribe();
    return () => { clearTimeout(t); void supabase.removeChannel(ch); };
  }, [user, reload]);

  const mode: "demo" | "team" = user ? "team" : "demo";
  const role: Role = team ? team.role : state.role;
  const statuses = team ? team.statuses : state.statuses;
  const narratives = team ? team.narratives : state.narratives;
  const audit = team ? team.audit : state.audit;
  const liveCases = team ? team.liveCases : state.liveCases;

  const entry = useCallback(
    (action: string, target: string, detail: string): AuditEntry => ({ id: crypto.randomUUID(), ts: Date.now(), role, action, target, detail, actor: user?.email ?? undefined }),
    [role, user],
  );

  /** Team mode: apply optimistically, write to Cloud, and resync from the database on failure. */
  const teamWrite = useCallback(
    (optimistic: (t: TeamSnapshot) => TeamSnapshot, write: () => Promise<unknown>) => {
      setTeam((t) => (t ? optimistic(t) : t));
      write().catch((e: unknown) => {
        toast.error("Not saved to the team workspace", { description: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });
        void reload();
      });
    },
    [reload],
  );

  const scenarios = useMemo(() => [...(liveCases ?? []), ...getScenarios()], [liveCases]);
  const detections = useMemo(() => scenarios.map((s) => (s.live ? liveDetection(s, state.settings) : runDetector(s, state.settings))), [scenarios, state.settings]);
  const cases = useMemo(() => detections.filter((d) => !d.suppressed).sort((a, b) => b.window.start - a.window.start), [detections]);
  const suppressed = useMemo(() => detections.filter((d) => d.suppressed), [detections]);

  const log = useCallback(
    (action: string, target: string, detail: string) => {
      const e = entry(action, target, detail);
      if (user) teamWrite((t) => ({ ...t, audit: [e, ...t.audit] }), () => appendAudit(user.id, action, target, detail));
      else setState((s) => ({ ...s, audit: [e, ...s.audit] }));
    },
    [entry, user, teamWrite],
  );

  const statusOf = useCallback(
    (caseRef: string) => statuses[caseRef] ?? detections.find((d) => d.caseRef === caseRef)?.defaultStatus ?? "new",
    [statuses, detections],
  );

  const setStatus = useCallback(
    (caseRef: string, next: CaseStatus, note?: string) => {
      if (!canSetStatus(role, next)) {
        toast.error(`Your role cannot set “${STATUS_LABEL[next]}”`);
        return false;
      }
      const action = `Status → ${STATUS_LABEL[next]}`, detail = note || "—";
      const e = entry(action, caseRef, detail);
      if (user) {
        teamWrite(
          (t) => ({ ...t, statuses: { ...t.statuses, [caseRef]: next }, audit: [e, ...t.audit] }),
          async () => { await saveStatus(caseRef, next); await appendAudit(user.id, action, caseRef, detail); },
        );
      } else {
        setState((s) => ({ ...s, statuses: { ...s.statuses, [caseRef]: next }, audit: [e, ...s.audit] }));
      }
      toast.success(`${caseRef} marked ${STATUS_LABEL[next]}`);
      return true;
    },
    [role, entry, user, teamWrite],
  );

  const setNarrative = useCallback(
    (caseRef: string, regime: Regime, text: string | null) => {
      const key = `${caseRef}:${regime}`;
      const apply = (n: Record<string, string>) => {
        const out = { ...n };
        if (text === null) delete out[key];
        else out[key] = text;
        return out;
      };
      const action = text === null ? `${regime} narrative reset` : `${regime} narrative edited`;
      const detail = text === null ? "Restored generated narrative" : `${text.length} characters`;
      const e = entry(action, caseRef, detail);
      if (user) {
        teamWrite(
          (t) => ({ ...t, narratives: apply(t.narratives), audit: [e, ...t.audit] }),
          async () => { await saveNarrative(caseRef, regime === "MARC" ? "MARC" : "MiCA", text); await appendAudit(user.id, action, caseRef, detail); },
        );
      } else {
        setState((s) => ({ ...s, narratives: apply(s.narratives), audit: [e, ...s.audit] }));
      }
    },
    [entry, user, teamWrite],
  );

  const updateSettings = useCallback(
    (settings: DetectionSettings) => {
      if (!can(role, "edit_settings")) {
        toast.error("Only Admins can change detection settings");
        return false;
      }
      setState((s) => ({ ...s, settings }));
      log("Settings updated", "system", `Alert threshold ${settings.minConfidence}`);
      return true;
    },
    [role, log],
  );

  const resetSettings = useCallback(() => {
    updateSettings(DEFAULT_SETTINGS);
  }, [updateSettings]);

  const scenarioOf = useCallback((caseRef: string) => scenarios.find((s) => s.caseRef === caseRef), [scenarios]);

  const buildPackage = useCallback(
    async (caseRef: string) => {
      const d = detections.find((x) => x.caseRef === caseRef);
      const sc = scenarios.find((x) => x.caseRef === caseRef);
      if (!d || !sc) return null;
      return buildEvidencePackage(d, sc, {
        role,
        status: statusOf(caseRef),
        generatedAt: new Date(),
        threshold: state.settings.minConfidence,
        cap: CONFIDENCE_CAP,
        narratives: { marc: narratives[`${caseRef}:MARC`], mica: narratives[`${caseRef}:MiCA`] },
        audit,
      });
    },
    [detections, scenarios, role, statusOf, state.settings.minConfidence, narratives, audit],
  );

  const promoteLive = useCallback(
    (sc: Scenario) => {
      const action = "Live lead promoted", detail = `${sc.trades.length} ticks · ${sc.venue.name} · ${sc.live?.alerts.join(", ")}`;
      const e = entry(action, sc.caseRef, detail);
      if (user) {
        teamWrite(
          (t) => ({ ...t, liveCases: [sc, ...t.liveCases], audit: [e, ...t.audit] }),
          async () => { await saveLiveCase(sc); await appendAudit(user.id, action, sc.caseRef, detail); },
        );
      } else {
        setState((s) => ({ ...s, liveCases: [sc, ...(s.liveCases ?? [])].slice(0, MAX_LIVE_CASES), audit: [e, ...s.audit] }));
      }
    },
    [entry, user, teamWrite],
  );

  const value: Ctx = {
    ready,
    mode,
    user,
    syncing,
    signOut: async () => { await supabase.auth.signOut(); toast.success("Signed out — back to demo mode"); },
    role,
    setRole: (r) => {
      if (user) { toast.info("Your role is set by a team Admin in Settings"); return; }
      setState((s) => ({ ...s, role: r }));
    },
    settings: state.settings,
    updateSettings,
    resetSettings,
    detections,
    cases,
    suppressed,
    statusOf,
    setStatus,
    narrativeOf: (caseRef, regime) => narratives[`${caseRef}:${regime}`],
    setNarrative,
    audit,
    log,
    scenarioOf,
    buildPackage,
    promoteLive,
  };

  return <ForgeContext.Provider value={value}>{children}</ForgeContext.Provider>;
}

const MAX_LIVE_CASES = 20;

/** Public-tape cases are leads: always listed, confidence capped because trades carry no account identity. */
export const LIVE_CONFIDENCE_CAP = 50;
function liveDetection(s: Scenario, cfg: DetectionSettings): Detection {
  const d = runDetector(s, cfg);
  return {
    ...d,
    suppressed: false,
    confidence: Math.min(d.confidence, LIVE_CONFIDENCE_CAP),
    summary: `Live lead promoted from ${s.venue.name} public tape (${s.trades.length} ticks): ${s.live?.alerts.join(", ")}. Requires venue account data before any attribution.`,
    limitations: ["Public trades carry no account identity; buyer/seller are anonymous aggressor/resting roles, so wallet clustering is not meaningful.", `Confidence capped at ${LIVE_CONFIDENCE_CAP} until venue KYC/order-book data is obtained.`, ...d.limitations],
  };
}

export function useForge() {
  const c = useContext(ForgeContext) as Ctx | null;
  if (!c) throw new Error("useForge must be used inside ForgeProvider");
  return c;
}
