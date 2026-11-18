import { useNavigate } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useLiveStream } from "@/lib/forge/live-stream";
import { liveToScenario } from "@/lib/forge/promote";
import { useForge } from "@/lib/forge/store";

/** Freezes the current live buffer into a case and opens its draft filings. */
export function PromoteLive({ size = "sm", always = false }: { size?: "sm" | "default"; always?: boolean }) {
  const { buf, alerts, base, venue } = useLiveStream();
  const { promoteLive } = useForge();
  const navigate = useNavigate();
  if (!always && alerts.length === 0) return null;
  const go = () => {
    if (buf.length < 50) { toast.error("Wait for at least 50 live ticks before promoting"); return; }
    const leads = alerts.length ? alerts : [{ kind: "burst" as const, label: "Manual analyst snapshot" }];
    const sc = liveToScenario(buf, leads, base, venue, Date.now());
    promoteLive(sc);
    toast.success(`${sc.caseRef} created from ${sc.trades.length} live ticks`);
    void navigate({ to: "/filings/$caseId", params: { caseId: sc.caseRef } });
  };
  return (
    <Button size={size} variant={alerts.length ? "destructive" : "outline"} onClick={go} className="gap-1.5">
      <FilePlus2 className="h-3.5 w-3.5" />Promote to case
    </Button>
  );
}
