# InstaSage AI

Creator analytics dashboard built with Next.js, NextAuth (Google), Prisma/Postgres, the YouTube Data API and Gemini.

## Setup

1. Install dependencies: `npm ci`
2. Copy `.env.example` to `.env.local` and fill it in:
   * `DATABASE_URL`: a Postgres database
   * `NEXTAUTH_SECRET`: any random string (`openssl rand -base64 32`)
   * `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: a Google OAuth client with `http://localhost:3000/api/auth/callback/google` as a redirect URI and the YouTube Data API v3 enabled
   * `GEMINI_API_KEY` (optional): enables AI insights
3. Create the tables: `npx prisma db push`
4. Start the app: `npm run dev` and open http://localhost:3000

Signing in with Google also grants read-only YouTube access, which connects your channel automatically. Use **Sync** on the Accounts page to pull in videos and stats.

## What is real vs. sample data

* Real: sign-in, Dashboard, AI Insights, Accounts, Account and Settings (connections, profile, delete account), CSV export at `/api/reports`
* Sample data for now: Analytics, Content Library, Recommendations, Audience, Competitors, Reports charts, and the AI chat assistant
* Instagram and Facebook connections are not available yet
