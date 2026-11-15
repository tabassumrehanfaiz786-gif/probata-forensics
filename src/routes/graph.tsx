import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const IntelGraph = lazy(() => import("@/components/forge/IntelGraph"));

export const Route = createFileRoute("/graph")({
  head: () => ({
    meta: [
      { title: "Global Intelligence Graph · Probata Forensics" },
      { name: "description", content: "Cross-chain wallet and entity network showing wash rings, funding paths, mixers, bridges and exchange exits." },
      { property: "og:title", content: "Global Intelligence Graph · Probata Forensics" },
      { property: "og:description", content: "Interactive cross-chain market-abuse entity graph for UK MAR and MiCA investigations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GraphPage,
});

function GraphPage() {
  const fallback = <div className="grid h-full place-items-center font-mono text-xs text-muted-foreground">Loading intelligence canvas…</div>;
  return (
    <div className="h-[calc(100vh-3rem)] w-full">
      <ClientOnly fallback={fallback}>
        <Suspense fallback={fallback}><IntelGraph /></Suspense>
      </ClientOnly>
    </div>
  );
}
