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

After logging in, add your channel's @handle under Settings or Accounts, then press **Sync** to pull in videos and stats.

## What is real vs. sample data

* Real: password login, Dashboard, AI Insights, Accounts, Account and Settings (connections, profile, delete account), CSV export at `/api/reports`
* Sample data for now: Analytics, Content Library, Recommendations, Audience, Competitors, Reports charts, and the AI chat assistant
* Instagram and Facebook connections are not available yet
