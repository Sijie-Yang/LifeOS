import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  sqliteTuned: boolean;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

if (!globalForPrisma.sqliteTuned) {
  globalForPrisma.sqliteTuned = true;
  void prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL").catch(() => {});
  void prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000").catch(() => {});
}
