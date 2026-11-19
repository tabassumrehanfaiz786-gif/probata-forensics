<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## EvidenceForge architecture
- Detection, legal mapping and evidence packaging live in `src/lib/forge/` as pure functions over scenario records; UI only reads `useForge()` — keeps scoring explainable and testable.
- Detection runs on a deterministic seeded replay dataset (`scenarios.ts`) so dataset hashes in evidence packages are reproducible; swap in live feeds behind the same `Scenario` shape.
- Signed-in users share one team workspace in Lovable Cloud (`cloud.ts`): case decisions, promoted live cases and an append-only audit log whose actor/role/time are stamped by DB triggers; signed-out visitors keep a browser-only demo mode so the public demo stays usable.
- Detector validation lives in pure `methodology.ts`: labelled benchmark truth plus historical reconstructions whose parameters are tagged cited (with official URL) or assumed.
- Live tape runs app-wide in `LiveStreamProvider` (root) with ordered public-exchange failover in `exchanges.ts`, so surveillance keeps running across pages and in regions where one venue is blocked.
- Regulatory filing drafts and admissibility checks are pure functions over `EvidencePackage` in `filings.ts`, so filings always match the hashed package.
- Live leads become cases via pure `promote.ts` (tick buffer → `Scenario` with `live` flag), stored in browser state; their confidence is capped in the store because public tape has no account identity.
- Real enforcement dossiers live in `dossiers.ts`; every fact and proceeding carries its own official-host source (tested) — never add wallet addresses or tx hashes not quoted in a linked official source.
