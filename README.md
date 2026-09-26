# InstaSage

A personal analytics studio for Instagram and YouTube creators. It syncs your real numbers, works out what is actually driving your growth, and uses the AI of your choice (Gemini, Claude, ChatGPT or anything on OpenRouter) to turn that into a 30-day game plan, brainstorming partner and monthly reports.

It is built for **one owner**: a single password, no signups, your data in your own database.

---

## What it does

| Page | What you get |
| --- | --- |
| **Overview** | Month story, followers or subscribers, reach or channel views, engagement, views per day, best time to post, top posts |
| **Analytics** | Reach (or YouTube channel views), views, engagement, follower growth and posting frequency over 7, 30, 90 or 365 days |
| **Content** | Every post or video, searchable and sortable. Open any one for an AI breakdown against your own averages |
| **AI Insights** | Patterns in your data: best formats, days, hours, caption length, hashtags, hooks, calls to action |
| **Ideas Studio** | **Game plan** (keep/stop list, content pillars, posting slots, 4 weeks of post ideas with hooks, experiments, targets), **Brainstorm** (saved chats with the AI), **Idea board** (Ideas → Planned → Posted), **Quick wins** |
| **Audience** | Instagram follower age, gender, countries and cities, plus when your posts do best |
| **Competitors** | Any Business or Creator account's followers, posting rhythm, format mix, likes and comments per post, top posts, a head-to-head table and AI "what to borrow, what to skip" |
| **Reports** | Real monthly numbers vs the previous month, an AI review, and a designed **PDF export** (plus CSV) |
| **Sage** | The chat bubble in the corner: ask anything about your numbers |

Other details:

* **Multiple accounts.** Connect several Instagram accounts and YouTube channels. The switcher in the top bar shows one or all of them.
* **YouTube mode.** Pick a channel and every page switches to subscribers, Shorts vs long videos and titles, and hides numbers YouTube does not share.
* **Your AI, your choice.** Save keys for several providers and pick the active one. If it is overloaded, the others step in automatically.
* **Local time everywhere.** Your timezone is detected (or picked in Settings) and used by charts, reports, the AI and the daily sync.
* **Daily auto sync.** Posts, insights and competitors refresh every morning on Vercel Cron.

---

## Tech stack

| | |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org) (App Router, React 19, TypeScript) |
| Styling | Tailwind CSS 4, Radix UI primitives, Recharts, lucide icons |
| Database | PostgreSQL through [Prisma 7](https://www.prisma.io) with the `pg` driver adapter |
| Auth | NextAuth (credentials, single password) |
| Data sources | Instagram API with Instagram Login, Instagram Business Discovery (Facebook Login), YouTube Data API v3 |
| AI | Gemini REST API, [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) (Claude), OpenAI and OpenRouter chat completions |
| PDF | jsPDF + jspdf-autotable, generated in the browser |
| Hosting | Vercel (with Vercel Cron) |

---

## Requirements

* **Node.js 20.9 or newer** (22 recommended) and npm
* A **PostgreSQL** database. Free options: [Neon](https://neon.tech), Prisma Postgres or Supabase. Or run Postgres locally.
* Optional, depending on what you want to connect:
  * A [Meta developer app](https://developers.facebook.com/apps) for Instagram (and Facebook Login for competitors)
  * A Google Cloud project with **YouTube Data API v3** enabled
  * An API key from at least one AI provider

---

## Run it locally

```bash
git clone https://github.com/PredatorWoah/instasage-ai.git
cd instasage-ai
npm ci                       # installs packages and generates the Prisma client
cp .env.example .env.local   # then fill in the values (see below)
npx prisma db push           # creates the tables
npm run dev                  # http://localhost:3000
```

Log in with your `APP_PASSWORD`, then:

1. **Accounts:** connect Instagram and/or add a YouTube channel, then press **Sync**
2. **Settings → AI models:** paste a key for Gemini, Claude, ChatGPT or OpenRouter
3. **Settings → Timezone:** check it shows your zone

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check |
| `npx prisma db push` | Sync the database with `prisma/schema.prisma` |
| `npx prisma studio` | Browse the database in the browser |

---

## Environment variables

Everything is listed in [`.env.example`](.env.example). Put them in `.env.local` locally, or under **Project Settings → Environment Variables** on Vercel. Real values never go in git (`.env*` is ignored, except the example).

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Everything | Postgres connection string |
| `APP_PASSWORD` | Login | The only password; use something long |
| `NEXTAUTH_SECRET` | Login | Any long random string: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Local login | `http://localhost:3000` locally; Vercel sets it automatically |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | Connect with Instagram | The **Instagram** app ID and secret, from the Instagram section of your Meta app |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Competitors | The **main** app ID and secret from App settings → Basic |
| `FACEBOOK_LOGIN_CONFIG_ID` | Competitors, Business-type apps | Only if Meta asks for a Facebook Login for Business configuration |
| `YOUTUBE_API_KEY` | YouTube | Optional; the key can be pasted on the Accounts page instead |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | AI | Optional default; AI keys are normally pasted in Settings |
| `CRON_SECRET` | Daily auto sync | Any long random string |

API keys you paste inside the app (AI providers, YouTube) are stored in your database and are never sent back to the browser. Only the last 4 characters are shown.

---

## Deploy to Vercel

1. Push the repo to your own GitHub account (fork or copy it).
2. On [vercel.com/new](https://vercel.com/new), import the repo. The framework is detected as Next.js.
3. Add a database. The easiest route is **Storage → Create → Neon / Prisma Postgres** inside the Vercel project, which fills in `DATABASE_URL` for you.
4. Add the environment variables above (at least `APP_PASSWORD`, `NEXTAUTH_SECRET` and `CRON_SECRET`).
5. Deploy. The `vercel-build` script runs `prisma db push` before `next build`, so the tables are created on every deploy.
6. Open your site, log in and connect accounts.

After changing any environment variable, **redeploy** (Deployments → ⋯ → Redeploy) so the app picks it up.

### Daily auto sync

[`vercel.json`](vercel.json) schedules `/api/cron/sync` every day at 01:00 UTC (6:30 AM in India). Change the `schedule` (cron syntax, UTC) to suit your timezone. Vercel sends `CRON_SECRET` with each run, and the route refuses anyone else. Each run syncs every account (oldest first), refreshes competitors, then regenerates AI insights if an AI key is saved. You can see runs under the project's **Cron Jobs** and **Logs**.

`vercel.json` holds only this schedule: no keys, URLs or personal data.

### Other hosts

Any Node host that can run `npm run build && npm start` works (Railway, Render, Fly.io, a VPS). Run `npx prisma db push` once against your database, set the same environment variables, and call `GET /api/cron/sync` with the header `Authorization: Bearer <CRON_SECRET>` once a day from any scheduler.

---

## Connecting your data

### Instagram

Needs Instagram **Business or Creator** accounts.

1. At [developers.facebook.com/apps](https://developers.facebook.com/apps), create an app with the **Instagram** use case. Add the `instagram_business_basic` and `instagram_business_manage_insights` permissions.
2. Open **Instagram → API setup with Instagram login → Set up Instagram business login**. Add `https://<your-domain>/api/connect/instagram/callback` as a valid OAuth redirect URI.
3. Copy the **Instagram app ID** and **Instagram app secret** into `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`, then redeploy.
4. While the app is in Development mode, add every account you want to connect under **App roles → Roles → Instagram Testers**, and accept the invite on instagram.com (Settings → Apps and websites).
5. In InstaSage: **Accounts → Connect with Instagram**.

Tokens last 60 days and renew on every sync. Promoted (boosted) posts are tagged, because Instagram's API only reports their organic results.

### YouTube

1. Create a project in [Google Cloud](https://console.cloud.google.com/projectcreate). It is free and needs no card.
2. Enable [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com).
3. Create an API key under [Credentials](https://console.cloud.google.com/apis/credentials). Optionally restrict it to YouTube Data API v3.
4. In InstaSage: **Accounts → YouTube → Save key**, then add your channel by `@handle` or URL. It syncs straight away.

Pick the channel in the top-right switcher to see YouTube mode. Watch time, retention and viewer demographics are private to YouTube Studio, so they are not available with an API key.

### Competitors

Meta only lets apps look up other accounts through **Business Discovery**, which needs a Facebook Login token. That makes it a second connection next to the Instagram one. The Competitors page walks through these steps and shows the exact redirect URI to copy:

1. Link your Instagram professional account to a Facebook Page you manage. Any Page works.
2. In the same Meta app, add **Facebook Login for Business** (or Facebook Login). Add `https://<your-domain>/api/connect/facebook/callback` as a valid OAuth redirect URI.
3. Business-type apps only: create a login configuration (User access token, with the permissions `instagram_basic`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement` and `business_management`). Put its ID in `FACEBOOK_LOGIN_CONFIG_ID`.
4. Set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`, then redeploy.
5. In InstaSage: **Competitors → Connect with Facebook**, then track any Business or Creator username.

Personal accounts cannot be looked up; that is Meta's rule.

### AI providers

Open **Settings → AI models**, pick a provider, paste a key and save. Each key is tested before it is stored.

| Provider | Get a key | Notes |
| --- | --- | --- |
| **Gemini** (Google) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Free tier; the newest Flash model is picked automatically |
| **Claude** (Anthropic) | [Claude Console](https://platform.claude.com/settings/keys) | Pay as you go; defaults to Claude Opus 5 with server-side fallbacks |
| **ChatGPT** (OpenAI) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Pay as you go; the newest GPT model on your key is picked |
| **OpenRouter** | [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) | One key for Llama, DeepSeek, Mistral, Grok and more; `:free` models cost nothing |

A Claude.ai or ChatGPT subscription does **not** include API use; those are billed separately. Normal InstaSage use costs cents a month.

---

## Project structure

```
prisma/schema.prisma        Database models
src/app/(auth)/login        Login page
src/app/(dashboard)/        Every page (overview, analytics, content, ideas, reports, ...)
src/app/api/                Route handlers (sync, AI, accounts, connect flows, cron, ...)
src/components/             UI, grouped by feature
src/lib/                    Auth, Prisma client, account scope, platform wording, client cache
src/services/
  instagram.ts, youtube.ts  Platform APIs
  sync.ts                   Pulls posts, insights and daily history into the database
  analysis.ts               Works out patterns before the AI sees anything
  llm.ts                    One interface over Gemini, Claude, OpenAI and OpenRouter
  ai.ts                     Insights, game plan, brainstorm, reports and post analysis
  competitors.ts            Facebook Login and Business Discovery
  reports.ts                Monthly numbers for the Reports page and PDF
src/proxy.ts                Redirects to /login when signed out (Next 16's middleware)
vercel.json                 Daily cron schedule
```

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Login says the password is wrong | Check `APP_PASSWORD` in Vercel (no quotes, no spaces) and redeploy |
| Login error mentioning a table | The database has no tables yet: run `npx prisma db push`, or redeploy on Vercel |
| "Invalid platform app" from Instagram | You used the Facebook app ID. Use the **Instagram** app ID and secret from the Instagram section of the Meta app |
| An Instagram account can't connect | Add it as an Instagram Tester and accept the invite, and make sure it is a Business or Creator account |
| Views look low on some posts | Those posts are boosted; Instagram only reports their organic numbers |
| "API has not been used / is disabled" (YouTube) | Enable YouTube Data API v3 on the key's Google Cloud project and wait a minute |
| AI says quota reached or overloaded | Wait a minute, or save a second provider's key so InstaSage can fall back to it |
| Times show in the wrong timezone | Settings → Timezone, turn off "Follow this device" and pick yours |
| Cron runs return 401 | Set `CRON_SECRET` in Vercel and redeploy |

---

## Security notes

* The whole app sits behind one password (`APP_PASSWORD`). Requests are checked in `src/proxy.ts` and again in every API route.
* Access tokens and API keys are stored in your database and never returned to the browser.
* Keep `.env.local` and your Vercel environment variables private. If a key leaks, revoke it at the provider and paste a new one.
