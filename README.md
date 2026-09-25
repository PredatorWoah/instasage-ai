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

Needs a Business or Creator Instagram account.

1. At developers.facebook.com, create an app with the Instagram use case.
2. In the app, open Instagram → **API setup with Instagram login** → **Generate access tokens**, add your Instagram account and copy the token.
3. Paste the token into the Instagram row in Settings.

The token lasts 60 days, and each sync refreshes it automatically.

### AI (Gemini)

Get a free key at https://aistudio.google.com/apikey and paste it under Settings → AI. It is tested before saving, and the newest Flash model your key can use is picked automatically. Insights and recommendations are cached; press Regenerate after a sync to refresh them.

### YouTube

Paste your channel's @handle. This needs `YOUTUBE_API_KEY`.

## What is real vs. sample data

* Real: password login, Dashboard, Analytics, Content Library, AI Insights, Recommendations, the AI chat assistant, Accounts, Account and Settings, CSV export at `/api/reports`
* Sample data for now: Audience, Competitors and the Reports charts
* Facebook connections are not available yet
