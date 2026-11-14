import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

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
}

const SEED_AUDIT: AuditEntry[] = [
  { id: "seed-1", ts: Date.UTC(2026, 10, 3, 19, 4), role: "analyst", action: "Status → Under review", target: "EF-2026-0139", detail: "Assigned to S. Lindqvist" },
  { id: "seed-2", ts: Date.UTC(2026, 10, 4, 11, 22), role: "compliance", action: "Status → Escalated", target: "EF-2026-0139", detail: "Referred to MLRO for STOR consideration" },
  { id: "seed-3", ts: Date.UTC(2026, 10, 3, 9, 40), role: "compliance", action: "Status → Dismissed", target: "EF-2026-0136", detail: "Token launch with public allocation; cohort linked to disclosed launch partners" },
  { id: "seed-4", ts: Date.UTC(2026, 10, 5, 14, 2), role: "analyst", action: "Status → Under review", target: "EF-2026-0144", detail: "Requested private order log from venue" },
  { id: "seed-5", ts: Date.UTC(2026, 10, 7, 13, 18), role: "analyst", action: "Status → Under review", target: "EF-2026-0147", detail: "KYC request drafted" },
];

const DEFAULT: Persisted = { role: "analyst", statuses: {}, narratives: {}, settings: DEFAULT_SETTINGS, audit: SEED_AUDIT };

interface Ctx {
  ready: boolean;
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
}

const ForgeContext = createContext<Ctx | null>(null);

export function ForgeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(DEFAULT);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

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

  const scenarios = getScenarios();
  const detections = useMemo(() => scenarios.map((s) => runDetector(s, state.settings)), [scenarios, state.settings]);
  const cases = useMemo(() => detections.filter((d) => !d.suppressed).sort((a, b) => b.window.start - a.window.start), [detections]);
  const suppressed = useMemo(() => detections.filter((d) => d.suppressed), [detections]);

  const log = useCallback((action: string, target: string, detail: string) => {
    setState((s) => ({ ...s, audit: [{ id: crypto.randomUUID(), ts: Date.now(), role: s.role, action, target, detail }, ...s.audit] }));
  }, []);

  const statusOf = useCallback(
    (caseRef: string) => state.statuses[caseRef] ?? detections.find((d) => d.caseRef === caseRef)?.defaultStatus ?? "new",
    [state.statuses, detections],
  );

  const setStatus = useCallback(
    (caseRef: string, next: CaseStatus, note?: string) => {
      if (!canSetStatus(state.role, next)) {
        toast.error(`Your role cannot set “${STATUS_LABEL[next]}”`);
        return false;
      }
      setState((s) => ({
        ...s,
        statuses: { ...s.statuses, [caseRef]: next },
        audit: [{ id: crypto.randomUUID(), ts: Date.now(), role: s.role, action: `Status → ${STATUS_LABEL[next]}`, target: caseRef, detail: note || "—" }, ...s.audit],
      }));
      toast.success(`${caseRef} marked ${STATUS_LABEL[next]}`);
      return true;
    },
    [state.role],
  );

  const setNarrative = useCallback((caseRef: string, regime: Regime, text: string | null) => {
    setState((s) => {
      const key = `${caseRef}:${regime}`;
      const narratives = { ...s.narratives };
      if (text === null) delete narratives[key];
      else narratives[key] = text;
      return {
        ...s,
        narratives,
        audit: [{ id: crypto.randomUUID(), ts: Date.now(), role: s.role, action: text === null ? `${regime} narrative reset` : `${regime} narrative edited`, target: caseRef, detail: text === null ? "Restored generated narrative" : `${text.length} characters` }, ...s.audit],
      };
    });
  }, []);

  const updateSettings = useCallback(
    (settings: DetectionSettings) => {
      if (!can(state.role, "edit_settings")) {
        toast.error("Only Admins can change detection settings");
        return false;
      }
      setState((s) => ({
        ...s,
        settings,
        audit: [{ id: crypto.randomUUID(), ts: Date.now(), role: s.role, action: "Settings updated", target: "system", detail: `Alert threshold ${settings.minConfidence}` }, ...s.audit],
      }));
      return true;
    },
    [state.role],
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
        role: state.role,
        status: statusOf(caseRef),
        generatedAt: new Date(),
        threshold: state.settings.minConfidence,
        cap: CONFIDENCE_CAP,
        narratives: { marc: state.narratives[`${caseRef}:MARC`], mica: state.narratives[`${caseRef}:MiCA`] },
        audit: state.audit,
      });
    },
    [detections, scenarios, state, statusOf],
  );

  const value: Ctx = {
    ready,
    role: state.role,
    setRole: (role) => setState((s) => ({ ...s, role })),
    settings: state.settings,
    updateSettings,
    resetSettings,
    detections,
    cases,
    suppressed,
    statusOf,
    setStatus,
    narrativeOf: (caseRef, regime) => state.narratives[`${caseRef}:${regime}`],
    setNarrative,
    audit: state.audit,
    log,
    scenarioOf,
    buildPackage,
  };

  return <ForgeContext.Provider value={value}>{children}</ForgeContext.Provider>;
}

export function useForge() {
  const c = useContext(ForgeContext);
  if (!c) throw new Error("useForge must be used inside ForgeProvider");
  return c;
}
