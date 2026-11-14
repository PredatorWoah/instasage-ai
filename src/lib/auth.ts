import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { DEMO_ID, demoEnabled } from "@/lib/demo";
import { ensureDemo } from "@/services/demo";

// Single-owner app: one password from the environment, one user row
const OWNER_ID = "owner";

function passwordMatches(input: string) {
  const expected = process.env.APP_PASSWORD?.trim();
  if (!expected) throw new Error("APP_PASSWORD is not set on the server. Add it in your hosting settings and redeploy.");
  // Hash both sides so the comparison is constant time regardless of length
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Password",
      credentials: { password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        if (!passwordMatches((credentials?.password ?? "").trim())) {
          // Slow down guessing
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return null;
        }
        try {
          const user = await prisma.user.upsert({
            where: { id: OWNER_ID },
            update: {},
            create: { id: OWNER_ID, name: "Owner" },
          });
          return { id: user.id, name: user.name };
        } catch (error) {
          console.error("Login failed: could not load the owner user", error);
          throw new Error("Password is correct, but the database is not ready. Check DATABASE_URL and that the tables exist (npx prisma db push).");
        }
      },
    }),
    // "Try the demo" on the login page: a separate account with made-up data, read-only, no AI.
    // It never sees the owner's data: every query is scoped to the signed-in user.
    ...(demoEnabled()
      ? [CredentialsProvider({
          id: "demo",
          name: "Demo",
          credentials: {},
          async authorize() {
            try {
              await ensureDemo();
              return { id: DEMO_ID, name: "Demo creator" };
            } catch (error) {
              console.error("Demo login failed:", error);
              throw new Error("The demo could not start. Try again in a minute.");
            }
          },
        })]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.sub = user.id;
      }
      if (trigger === "update" && typeof session?.name === "string") {
        token.name = session.name;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
};
