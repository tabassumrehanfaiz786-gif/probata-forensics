import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABEL, STATUS_LABEL } from "@/lib/forge/format";
import { canSetStatus, PERMISSION_MATRIX, statusPermission } from "@/lib/forge/permissions";
import { useForge } from "@/lib/forge/store";
import type { CaseStatus } from "@/lib/forge/types";

const ACTIONS: { status: CaseStatus; label: string; variant: "default" | "outline" | "secondary" }[] = [
  { status: "under_review", label: "Mark under review", variant: "outline" },
  { status: "escalated", label: "Escalate", variant: "default" },
  { status: "dismissed", label: "Dismiss", variant: "secondary" },
  { status: "new", label: "Reopen", variant: "outline" },
];

export function StatusActions({ caseRef }: { caseRef: string }) {
  const { role, statusOf, setStatus } = useForge();
  const current = statusOf(caseRef);
  const [target, setTarget] = useState<CaseStatus | null>(null);
  const [note, setNote] = useState("");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.filter((a) => a.status !== current && (a.status !== "new" || current !== "new")).map((a) => {
          const allowed = canSetStatus(role, a.status);
          const who = PERMISSION_MATRIX[statusPermission(a.status)].map((r) => ROLE_LABEL[r]).join(" / ");
          return (
            <Button
              key={a.status}
              size="sm"
              variant={a.status === "escalated" ? "default" : a.variant}
              className={a.status === "escalated" ? "bg-critical text-critical-foreground hover:bg-critical/90" : ""}
              disabled={!allowed}
              title={allowed ? undefined : `Requires ${who}`}
              onClick={() => { setNote(""); setTarget(a.status); }}
            >
              {a.label}
            </Button>
          );
        })}
      </div>
      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target ? `${STATUS_LABEL[target]}: ${caseRef}` : ""}</DialogTitle>
            <DialogDescription>Recorded in the audit trail with your role ({ROLE_LABEL[role]}) and included in future evidence packages.</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={target === "dismissed" ? "Reason for dismissal (required)" : "Note (optional)"} rows={4} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button
              disabled={target === "dismissed" && !note.trim()}
              onClick={() => { if (target && setStatus(caseRef, target, note.trim())) setTarget(null); }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
