import type { CaseStatus, Role } from "./types";

export type Permission = "mark_under_review" | "escalate" | "dismiss" | "reopen" | "edit_narrative" | "export_final" | "edit_settings";

const MATRIX: Record<Permission, Role[]> = {
  mark_under_review: ["analyst", "compliance", "admin"],
  escalate: ["compliance", "admin"],
  dismiss: ["compliance", "admin"],
  reopen: ["compliance", "admin"],
  edit_narrative: ["analyst", "compliance"],
  export_final: ["compliance", "admin"],
  edit_settings: ["admin"],
};

export const can = (role: Role, p: Permission) => MATRIX[p].includes(role);

export function statusPermission(next: CaseStatus): Permission {
  if (next === "under_review") return "mark_under_review";
  if (next === "escalated") return "escalate";
  if (next === "dismissed") return "dismiss";
  return "reopen";
}

export const canSetStatus = (role: Role, next: CaseStatus) => can(role, statusPermission(next));

export const PERMISSION_MATRIX = MATRIX;
