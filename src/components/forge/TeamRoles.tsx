import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { topRole } from "@/lib/forge/cloud";
import { ROLE_LABEL } from "@/lib/forge/format";
import { useForge } from "@/lib/forge/store";
import type { Role } from "@/lib/forge/types";

/** Team members and their roles. Only Admins can change roles; the database enforces it. */
export function TeamRoles() {
  const { mode, role, user, log } = useForge();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["team-roles"],
    enabled: mode === "team",
    queryFn: async () => {
      const [p, r] = await Promise.all([supabase.from("profiles").select("id,email,display_name").order("created_at"), supabase.from("user_roles").select("user_id,role")]);
      if (p.error) throw p.error;
      if (r.error) throw r.error;
      return (p.data ?? []).map((m) => ({ ...m, role: topRole((r.data ?? []).filter((x) => x.user_id === m.id).map((x) => x.role as Role)) }));
    },
  });
  if (mode !== "team") return null;
  const isAdmin = role === "admin";

  const change = async (id: string, email: string | null, next: Role) => {
    const del = await supabase.from("user_roles").delete().eq("user_id", id);
    const ins = del.error ? del : await supabase.from("user_roles").insert({ user_id: id, role: next });
    if (ins.error) { toast.error(ins.error.message); }
    else { toast.success(`${email ?? "Member"} is now ${ROLE_LABEL[next]}`); log("Role changed", email ?? id, `→ ${ROLE_LABEL[next]}`); }
    void qc.invalidateQueries({ queryKey: ["team-roles"] });
  };

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Team roles</h2>
        <span className="ml-auto text-xs text-muted-foreground">{isAdmin ? "You can change roles" : "Only Admins can change roles"}</span>
      </div>
      <ul className="divide-y divide-border">
        {(q.data ?? []).map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="flex-1 truncate">{m.email}{m.id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</span>
            {isAdmin && m.id !== user?.id ? (
              <Select value={m.role} onValueChange={(v) => void change(m.id, m.email, v as Role)}>
                <SelectTrigger className="h-8 w-40 text-xs" aria-label={`Role for ${m.email}`}><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <SelectItem key={r} value={r} className="text-xs">{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <span className="font-mono text-xs text-primary">{ROLE_LABEL[m.role]}</span>
            )}
          </li>
        ))}
        {q.isLoading && <li className="px-4 py-3 text-sm text-muted-foreground">Loading team…</li>}
      </ul>
    </section>
  );
}
