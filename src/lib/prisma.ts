import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Serverless-friendly pool: every function instance keeps its own pool, so keep it small (a burst of
// parallel requests can otherwise run past the database's connection limit), hand idle connections
// back quickly, and give up with a clear error instead of waiting forever. The timeout leaves room
// for a free-tier database waking up from sleep.
// Opening a connection to a hosted database costs several round trips (TCP, TLS, login), so connections
// are kept for a minute between requests instead of 10 seconds: moving between pages reuses them.
// Room for 8 at once, so a background sync never leaves a page waiting for a free connection.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
});

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter: new PrismaPg(pool),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
