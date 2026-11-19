import { describe, expect, it } from "vitest";

import { DOSSIERS, OFFICIAL_HOSTS } from "@/lib/forge/dossiers";
import { confusion, RECONSTRUCTIONS } from "@/lib/forge/methodology";
import { auditCsv } from "@/lib/forge/export";

const official = (url: string) => OFFICIAL_HOSTS.some((h) => new URL(url).hostname.endsWith(h));

describe("dossier citations", () => {
  it("every dossier fact and proceeding links to an official source", () => {
    for (const d of DOSSIERS) {
      for (const f of d.facts) expect(official(f.source.url), f.text).toBe(true);
      for (const p of d.proceedings) expect(official(p.source.url), p.forum).toBe(true);
    }
  });
});

describe("methodology", () => {
  it("every cited reconstruction parameter has a source", () => {
    for (const rc of RECONSTRUCTIONS) for (const p of rc.params) if (p.kind === "cited") expect(p.source, p.name).toBeTruthy();
  });
  it("computes precision and recall from the confusion matrix", () => {
    const c = confusion([{ truth: "manipulative", flagged: true }, { truth: "benign", flagged: true }, { truth: "manipulative", flagged: false }, { truth: "benign", flagged: false }]);
    expect(c.precision).toBe(0.5);
    expect(c.recall).toBe(0.5);
  });
});

describe("export", () => {
  it("escapes commas and quotes in audit CSV", () => {
    const csv = auditCsv([{ id: "1", ts: 0, role: "analyst", action: "Note", target: "EF-1", detail: 'a, "b"' }]);
    expect(csv.split("\r\n")[1]).toContain('"a, ""b"""');
  });
});
