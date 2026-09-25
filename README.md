# InstaSage AI

Creator analytics dashboard built with Next.js, NextAuth (Google), Prisma/Postgres, the YouTube Data API and Gemini.

## Setup

This is a single-user app: one password, no signup.

1. Install dependencies: `npm ci`
2. Copy `.env.example` to `.env.local` and fill it in:
   * `DATABASE_URL`: a Postgres database
   * `APP_PASSWORD`: the password you log in with
   * `NEXTAUTH_SECRET`: any long random string (`openssl rand -base64 32`)
   * `YOUTUBE_API_KEY`: a YouTube Data API v3 key from Google Cloud Console
3. Create the tables: `npx prisma db push`
4. Start the app: `npm run dev` and open http://localhost:3000

After logging in, connect accounts under Settings (or on the Accounts page), then press **Sync** on the Accounts page.

### Instagram

Needs Business or Creator Instagram accounts. You can connect as many as you like; the switcher in the top bar shows one account or all of them.

One-time setup of **Connect with Instagram**:
1. At developers.facebook.com, create an app with the Instagram use case and add the `instagram_business_basic` and `instagram_business_manage_insights` permissions.
2. Open Instagram → **API setup with Instagram login** → **Set up Instagram business login**. Add `https://<your-domain>/api/connect/instagram/callback` as a valid OAuth redirect URI.
3. Copy the **Instagram app ID** and **Instagram app secret** into `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`, then redeploy.
4. While the app is in Development mode, add each Instagram account under App roles → Roles → **Instagram Testers** and accept the invite on instagram.com.

Then click **Connect with Instagram** in Settings or on the Accounts page, log in, and the account is added and synced. Pasting a token from the Meta dashboard still works under "Advanced". Tokens last 60 days and are refreshed on every sync.

Boosted posts are tagged: Instagram's API reports their organic results only.

### Daily auto-sync

`vercel.json` schedules `/api/cron/sync` every day at 01:00 UTC. Set `CRON_SECRET` in Vercel (any long random string) and redeploy; Vercel sends it with each run, and the route refuses requests without it. It syncs every account, oldest first, then refreshes AI insights when a Gemini key is saved. Runs show up under the project's Cron Jobs and Logs in Vercel.

### AI (Gemini)

Get a free key at https://aistudio.google.com/apikey and paste it under Settings → AI. It is tested before saving, and the newest Flash model your key can use is picked automatically. Insights and recommendations are cached; press Regenerate after a sync to refresh them.

### YouTube

Paste your channel's @handle. This needs `YOUTUBE_API_KEY`.

## What is real vs. sample data

* Real: password login, Dashboard, Analytics, Content Library, AI Insights, Recommendations, the AI chat assistant, Accounts, Account and Settings, CSV export at `/api/reports`
* Sample data for now: Audience, Competitors and the Reports charts
* Facebook connections are not available yet
