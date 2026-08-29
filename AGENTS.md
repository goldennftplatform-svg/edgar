<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Metap Watch conventions

- EDGAR/AI/market stacks all degrade gracefully: real API -> mock/fallback -> never crash. UI shows LIVE vs FALLBACK.
- `src/lib/x402.ts` is the pay-per-call integration (stackai-x402 SDK). CLEAN SCOPE ONLY: core x402 gateway/SDK payments are fine; the Moltbook autonomous-promo/engagement agent is intentionally EXCLUDED (it is spam/astroturfing).
- x402 SDK is loaded dynamically only when `X402_GATEWAY_URL` + `X402_AGENT_ID` are set — keeps the serverless bundle lean and avoids Stacks deps on the default path.
- The `stackai-x402` package pulls a vulnerable transitive axios via `x402-stacks`. `npm audit fix` cannot resolve it (hard pinned). It only runs on the opt-in x402 path, not the default free/local path.
