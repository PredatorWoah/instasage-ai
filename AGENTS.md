<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# InstaSage: notes for AI helpers

Eric's personal Instagram + YouTube analytics studio (Next.js 16, React 19, Prisma 7 on Postgres, deployed on Vercel).
One owner, one password, no signups. The README has the full feature list, setup, env vars and a project structure
section: read the part you need, not the whole file.

## Where things are
- Pages: `src/app/(dashboard)/<page>` (overview, analytics, content, insights, recommendations = Ideas Studio,
  audience, competitors, comments, reports, status, settings, accounts). Login: `src/app/(auth)/login`.
- API routes: `src/app/api/<area>` (accounts, ai, alerts, analytics, comments, competitors, connect, cron, export,
  ideas, insights, posts, push, refresh, reports, ...).
- Business logic: `src/services/` (sync, instagram, youtube, analysis, llm/ai, competitors, comments, reports, push).
  Shared helpers: `src/lib/` (prisma client, auth, platform switching, caching hooks).
- Database: `prisma/schema.prisma` (User, SocialProfile, Post, PostSnapshot, Metric, SyncJob, AiResult, AiCredential,
  ideas, competitors, AiUsage, push, AppConfig). Schema changes: edit the schema, then `npx prisma generate`; Vercel
  runs `prisma db push` on deploy (`vercel-build`), so a schema change reaches the live database on the next deploy.
- Daily sync: Vercel cron hits `/api/cron/sync` at 01:00 UTC (`vercel.json`), protected by `CRON_SECRET`.

## Run and check
- `npm install` (runs `prisma generate`), then `npm run dev`. Needs a `.env` filled from `.env.example`
  (DATABASE_URL, APP_PASSWORD, NEXTAUTH_*, Instagram/Facebook app ids, YouTube and Gemini keys, VAPID keys).
  There is no `.env` on this PC yet: ask Eric before creating one, and never commit it or print its values.
- No test suite. Before saying done: `npm run lint` and `npm run build` must pass, and check the changed page in the
  browser (dev server) when it's UI.

## Rules
- Next.js 16 differs from what you know (see the note above): check `node_modules/next/dist/docs/` for the API you use.
- AI keys are stored as-is in `AiCredential.apiKey` (not encrypted). Never send them to the browser, return them from
  an API route, or log them; mask them in the UI. Instagram/YouTube calls go through `src/services`, not straight
  from components.
- Commits/PRs look like `fix: ...` / `feat: ...` with the PR number. Work on a branch + PR; never push to `main`
  or trigger a deploy without Eric saying so.
