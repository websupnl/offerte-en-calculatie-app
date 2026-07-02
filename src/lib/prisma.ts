import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Re-triggering build for schema changes

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  // On serverless (Vercel) each function instance must limit connections.
  // max:1 prevents exhausting PG's connection limit across concurrent invocations.
  const pool = new Pool({ connectionString, max: 1 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
