# InstaSage

A personal analytics studio for Instagram and YouTube creators. It syncs your real numbers, works out what is actually driving your growth, and uses the AI of your choice (Gemini, Claude, ChatGPT or anything on OpenRouter) to turn that into a 30-day game plan, brainstorming partner and monthly reports.

It is built for **one owner**: a single password, no signups, your data in your own database.

---

## What it does

| Page | What you get |
| --- | --- |
| **Overview** | Month story, followers or subscribers, reach or channel views, engagement, views per day, best time to post, top posts |
| **Analytics** | Reach (or YouTube channel views), views, engagement, follower growth and posting frequency over 7, 30, 90 or 365 days, each headline number against the period before, and the follow funnel |
| **Content** | Every post or video in a table or a grid, searchable, sortable and filtered by date range, with saved views and CSV export of what you filtered. Open any one for an AI breakdown against your own averages |
| **AI Insights** | Patterns in your data: best formats, days, hours, caption length, hashtags, hooks, calls to action |
| **Ideas Studio** | **Game plan** (keep/stop list, content pillars, posting slots, 4 weeks of post ideas with hooks, experiments, targets), **Brainstorm** (saved chats with the AI), **Idea board** (Ideas → Planned → Posted), **Calendar** (posted, planned and open game plan slots; drag to reschedule, export to any calendar app as .ics), **Quick wins** |
| **Audience** | Instagram follower age, gender, countries and cities, plus when your posts do best, with a weekday by hour heatmap |
| **Competitors** | Any Business or Creator account's followers, posting rhythm, format mix, likes and comments per post, top posts, a head-to-head table and AI "what to borrow, what to skip" |
| **Comments** | Unanswered Instagram comments on recent posts, three AI reply drafts each in your voice, reply or hide in one tap (needs the comments permission, asked for on first use) |
| **Reports** | Real monthly numbers vs the previous month, an AI review, and a designed **PDF export** (plus CSV) |
| **Status** | Health of every account, the AI, competitor tracking and recent syncs, with a fix button next to anything broken |
| **Sage** | The chat bubble in the corner: ask anything about your numbers |

Other details:

* **Multiple accounts.** Connect several Instagram accounts and YouTube channels. The switcher in the top bar shows one or all of them.
* **YouTube mode.** Pick a channel and every page switches to subscribers, Shorts vs long videos and titles, and hides numbers YouTube does not share.
* **Your AI, your choice.** Save keys for several providers and pick the active one. If it is overloaded, the others step in automatically.
* **Local time everywhere.** Your timezone is detected (or picked in Settings) and used by charts, reports, the AI and the daily sync.
* **Creator profile.** Your niche, audience, goals, voice, topics to avoid and how many posts a week you can make. Every plan, idea and script respects it.
* **Ideas that learn.** Link a posted idea to the real post and see how it did against your average; the Game plan and Brainstorm learn from the results.
* **Write it for me.** One click on any idea gives a reel script, carousel outline or caption in your voice.
* **Goal tracker.** Set a follower or subscriber goal and see progress, the date you'll hit it at your current pace, and the pace a deadline needs.
* **Different AI per feature, and usage.** For example a strong model for the Game plan and a free one for chat. Settings shows what each feature used over 30 days and the estimated cost.
* **Heads-up banner and setup checklist.** A warning when an account disconnects, a token is about to expire or a sync fails, and a first-run checklist for new installs.
* **Funnel.** Accounts reached, engaged, profile visits, link taps, follows and unfollows for the last 30 days on Analytics, so you can see where people drop off.
* **How each post grew.** Every post's first two weeks are tracked, so its page shows a growth curve, views at about a day old against your usual post, and reel watch time and skip rate.
* **Rival trends.** Daily follower snapshots give every competitor a sparkline and a 30 day growth column.
* **Alerts.** The bell flags a post outperforming your average, a long gap since your last post, follower milestones and drops, and a rival post going viral.
* **Install it as an app.** Add InstaSage to your phone's home screen or install it from the desktop browser's address bar. It opens full screen and shows a friendly page when offline.
* **Push notifications.** Turn them on per device in Settings: alerts (each sent once) and a morning digest after the daily sync. On iPhone, add it to the home screen first.
* **Command palette.** Ctrl+K (Cmd+K on Mac) jumps to any page, section or post, switches accounts, syncs, or changes the theme.
* **Light and dark themes.** Pick one in Settings, or follow your device.
* **Export for ChatGPT or Claude.** One click copies your worked-out numbers plus ready-made instructions (game plan, review, brainstorm or your own question) to paste into a chat app you already pay for. No API needed.
* **Always fresh.** Counts refresh whenever you open the app, and posts, insights and competitors sync every morning on Vercel Cron.

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
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Push notifications | Optional. A key pair is generated on first use and stored in the database; set these only to bring your own |

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

### Auto refresh

When you open the app, follower and subscriber counts refresh within seconds, and a full sync runs if the last one is more than 6 hours old (or the 30 day reach number is missing). So the numbers stay fresh even if the daily cron isn't set up.

### Daily auto sync

[`vercel.json`](vercel.json) schedules `/api/cron/sync` every day at 01:00 UTC (6:30 AM in India). Change the `schedule` (cron syntax, UTC) to suit your timezone. Vercel sends `CRON_SECRET` with each run, and the route refuses anyone else. Each run syncs every account (oldest first), refreshes competitors, sends push notifications (new alerts and the morning digest) to devices that turned them on, then regenerates AI insights if an AI key is saved. You can see runs under the project's **Cron Jobs** and **Logs**.

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
| **Gemini** (Google) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Free tier. The newest Flash model your key can use is picked, and if Google retires it InstaSage switches to a current one by itself. `gemini-4-argon` appears in the model list when your plan includes it; **Refresh models** in Settings re-reads the list |
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
