import { describe, expect, it } from "vitest";

import { CONFIDENCE_CAP, runDetector } from "@/lib/forge/detection";
import { mapLegal } from "@/lib/forge/legal";
import { can, canSetStatus } from "@/lib/forge/permissions";
import { getScenarios } from "@/lib/forge/scenarios";
import { DEFAULT_SETTINGS } from "@/lib/forge/types";

const det = (ref: string) => runDetector(getScenarios().find((s) => s.caseRef === ref)!, DEFAULT_SETTINGS);

describe("roles", () => {
  it("analysts cannot escalate or dismiss", () => {
    expect(canSetStatus("analyst", "escalated")).toBe(false);
    expect(canSetStatus("analyst", "dismissed")).toBe(false);
    expect(canSetStatus("analyst", "under_review")).toBe(true);
  });
  it("compliance can escalate and dismiss", () => {
    expect(canSetStatus("compliance", "escalated")).toBe(true);
    expect(canSetStatus("compliance", "dismissed")).toBe(true);
  });
  it("only admins change settings", () => {
    expect(can("admin", "edit_settings")).toBe(true);
    expect(can("compliance", "edit_settings")).toBe(false);
    expect(can("analyst", "edit_settings")).toBe(false);
  });
});

describe("precision first", () => {
  it("flags the wash trading cluster above the default threshold", () => {
    expect(det("EF-2026-0147").suppressed).toBe(false);
  });
  it("suppresses the legitimate market maker and HFT quoter", () => {
    expect(det("EF-2026-0153").suppressed).toBe(true);
    expect(det("EF-2026-0154").suppressed).toBe(true);
  });
  it("never reports a confidence above the cap", () => {
    for (const s of getScenarios()) expect(runDetector(s, DEFAULT_SETTINGS).confidence).toBeLessThanOrEqual(CONFIDENCE_CAP);
  });
});

describe("legal humility", () => {
  it("every legal mapping carries counter-arguments for both regimes", () => {
    for (const s of getScenarios()) {
      const d = runDetector(s, DEFAULT_SETTINGS);
      expect(mapLegal(d, "MARC").counterArguments.length).toBeGreaterThan(0);
      expect(mapLegal(d, "MiCA").counterArguments.length).toBeGreaterThan(0);
    }
  });
});
