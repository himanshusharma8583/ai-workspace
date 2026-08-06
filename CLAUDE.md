@AGENTS.md

# AI Workspace — project context

Resume-grade full-stack app (Notion + ChatGPT + GitHub for teams) by Himanshu Sharma. **Everything must run on free tiers.** Owner is a beginner: explain commands/files simply, ask before destructive commands (rm, resets, drops, force-push, killing processes), never print/log/commit `.env` contents. Prefer small verified steps; commit after each working feature (short present-tense messages). Design every API as if 1M users depend on it.

**Live:** https://ai-workspace-self-13fa.vercel.app — every push to `main` auto-deploys (Vercel project "ai-workspace", env vars: DATABASE_URL, AUTH_SECRET, GEMINI_API_KEY, GROQ_API_KEY).

## Stack (locked — ask before swapping)
Next.js 16.3 App Router + TS + Tailwind v4 (`src/`, `@/*` alias) · Prisma 7 + Neon Postgres (Singapore) with pgvector · next-auth v5 beta (credentials, JWT) · zod v4 · LangChain with **Gemini** (`gemini-3.5-flash`, pinned) + **Groq** (`openai/gpt-oss-120b`) and mutual failover · Vercel hosting.

## Prisma 7 specifics
- `datasource db` has NO url; URL lives in `prisma.config.ts` (dotenv + defineConfig)
- Generated client at `src/generated/prisma` (gitignored; `build` runs `prisma generate` first)
- `src/lib/prisma.ts` uses `@prisma/adapter-pg` driver adapter
- **Restart the dev server after `prisma generate`** — it caches the old client

## Architecture map
- `src/lib/workspace.ts` — `getWorkspaceContext()` = the tenant boundary; every business query MUST scope by `organizationId`; `canEdit`/`canDelete` role helpers
- `src/lib/auth.config.ts` (edge-safe, no Prisma) + `src/lib/auth.ts` (full) — split so `src/proxy.ts` (Next 16's renamed middleware) does cookie-only checks
- `src/lib/ai.ts` — ALL model choices + provider failover; plain-text `TITLE:\n---\nbody` output format (never JSON — models botch escaping)
- `src/lib/rag.ts` — chunking, Gemini embeddings (768-dim, REST), org-filtered pgvector search (HNSW index)
- `src/lib/agent.ts` — workspace agent: tool-calling loop (search/list/read/activity(+create/update if role allows)) behind `/api/ai/chat`
- Models: User, Organization, Membership (roles), Document, DocumentVersion (append-only snapshots), DocumentChunk, ActivityLog, Invitation

## Done and verified (all live)
Auth · signup with atomic org creation · dashboard · documents CRUD (cursor pagination) · version history + restore · member invite links + members page · RBAC · AI doc generation · AI meeting summaries (Groq) · RAG chat with citations · workspace AI agent · activity logs · README with screenshots

## Next (agreed order)
1. Upstash Redis rate limiting (owner creates free account when asked)
2. File uploads (Vercel Blob)
3. Stripe test-mode billing
4. AI code assistant (LangGraph here)
5. Real-time collab (polling or Liveblocks)
6. Portfolio Dockerfile

## Gotchas learned
- Free-tier quotas are per-model; `-latest` aliases resolve to the newest model with the TIGHTEST quota (gemini-3.6-flash: 20 req/day). Pin models.
- Local dev runs on port 3001 (another app owns 3000). Never `pkill next` — kill by port.
- Git: personal account (himanshusharma8583), PAT in keychain; do NOT change repo git identity.
- Test accounts (password in each): ada@example.com / adapassword123 · charles@example.com / enginepass123 · test@example.com / password123 (all dev+prod share the same Neon DB).
