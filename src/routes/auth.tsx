import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { Scale } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useForge } from "@/lib/forge/store";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Probata Forensics" },
      { name: "description", content: "Sign in to the shared Probata Forensics team workspace to save case decisions and the audit log." },
      { property: "og:title", content: "Sign in · Probata Forensics" },
      { property: "og:description", content: "Team workspace for crypto market abuse investigations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const GoogleG = () => (
  <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function AuthPage() {
  const { user } = useForge();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) void navigate({ to: "/" }); }, [user, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Check your email for a reset link");
        setMode("in");
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "lovable") => {
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message ?? "Sign-in failed");
  };

  return (
    <div className="grid min-h-[calc(100vh-3rem)] place-items-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md border border-primary/40 bg-primary/10"><Scale className="h-4 w-4 text-primary" /></div>
          <div>
            <h1 className="text-lg font-semibold">{mode === "up" ? "Create team account" : mode === "forgot" ? "Reset password" : "Sign in to the team workspace"}</h1>
            <p className="text-xs text-muted-foreground">Case decisions and the audit log are shared with everyone on the team.</p>
          </div>
        </div>
        {mode !== "forgot" && (
          <div className="space-y-2">
            <Button type="button" onClick={() => void oauth("google")} className="w-full gap-2.5 border border-[#8E918F] bg-[#131314] font-medium text-[#E3E3E3] hover:bg-[#131314]/90">
              <GoogleG />Continue with Google
            </Button>
            <Button type="button" variant="outline" onClick={() => void oauth("lovable")} className="w-full">
              <LovableMark />Continue with Lovable
            </Button>
          </div>
        )}
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          {mode !== "forgot" && (
            <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} /></div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>{mode === "up" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}</Button>
        </form>
        <div className="flex justify-between text-xs">
          <button type="button" className="text-primary hover:underline" onClick={() => setMode(mode === "up" ? "in" : "up")}>{mode === "up" ? "Have an account? Sign in" : "New here? Create an account"}</button>
          {mode === "in" && <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("forgot")}>Forgot password?</button>}
          {mode === "forgot" && <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("in")}>Back</button>}
        </div>
        <p className="text-center text-xs text-muted-foreground">Or <Link to="/" className="text-primary hover:underline">keep exploring in demo mode</Link> — changes stay in this browser only.</p>
      </div>
    </div>
  );
}
