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
   * `GEMINI_API_KEY` (optional): enables AI insights
3. Create the tables: `npx prisma db push`
4. Start the app: `npm run dev` and open http://localhost:3000

After logging in, connect accounts under Settings (or on the Accounts page), then press **Sync** on the Accounts page.

### Instagram

Needs a Business or Creator Instagram account.

1. At developers.facebook.com, create an app with the Instagram use case.
2. In the app, open Instagram → **API setup with Instagram login** → **Generate access tokens**, add your Instagram account and copy the token.
3. Paste the token into the Instagram row in Settings.

The token lasts 60 days, and each sync refreshes it automatically.

### YouTube

Paste your channel's @handle. This needs `YOUTUBE_API_KEY`.

## What is real vs. sample data

* Real: password login, Dashboard, AI Insights, Accounts, Account and Settings (connections, profile, delete account), CSV export at `/api/reports`
* Sample data for now: Analytics, Content Library, Recommendations, Audience, Competitors, Reports charts, and the AI chat assistant
* Facebook connections are not available yet
