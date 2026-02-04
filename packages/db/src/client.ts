import { PrismaClient } from "@prisma/client";

declare global {
  var __windhelmPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__windhelmPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalThis.__windhelmPrisma = prisma;
