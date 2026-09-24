import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import InstagramProvider from "next-auth/providers/instagram";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { connectYouTubeProfile } from "@/services/youtube";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/youtube.readonly",
          // Needed so we get a refresh_token for background syncs
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    InstagramProvider({
      clientId: process.env.INSTAGRAM_CLIENT_ID || "",
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || "",
    }),
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
  events: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !account.access_token) return;
      if (!account.scope?.includes("youtube.readonly")) return;
      try {
        await connectYouTubeProfile(user.id, account);
      } catch (error) {
        // A Google account without a YouTube channel is fine; just skip it
        console.error("Failed to connect YouTube profile:", error);
      }
    },
  },
  pages: {
    signIn: '/login',
  },
};
