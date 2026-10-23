import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BACKUP_MODELS, validateFullBackup, type BackupRows, type FullBackup } from "./backup-format";

type TableDelegate = {
  findMany(): Promise<Record<string, unknown>[]>;
  deleteMany(): Promise<unknown>;
  createMany(args: { data: Record<string, unknown>[] }): Promise<unknown>;
};
function table(tx: Prisma.TransactionClient, name: string): TableDelegate {
  // Names come exclusively from the generated Prisma schema, never user input.
  return (tx as unknown as Record<string, TableDelegate>)[name[0].toLowerCase() + name.slice(1)];
}

export async function exportFullBackup(client: PrismaClient = prisma): Promise<FullBackup> {
  return client.$transaction(async (tx) => {
    const tables: BackupRows = {};
    for (const model of BACKUP_MODELS) tables[model.name] = await table(tx, model.name).findMany();
    // Normalize Date objects to the exact portable representation used by restore validation.
    return JSON.parse(JSON.stringify({ format: "lifeos", version: "2.0", exportedAt: new Date().toISOString(), tables }));
  }, { timeout: 60_000 });
}

export async function restoreFromBackup(input: unknown, client: PrismaClient = prisma) {
  // All shape/type checks run before the first destructive statement.
  const body = validateFullBackup(input);
  await client.$transaction(async (tx) => {
    // SQLite cannot toggle foreign_keys inside a transaction. Defer checks until all tables are restored.
    await tx.$executeRawUnsafe("PRAGMA defer_foreign_keys = ON");
    for (const model of [...BACKUP_MODELS].reverse()) await table(tx, model.name).deleteMany();
    for (const model of BACKUP_MODELS) {
      const rows = body.tables[model.name];
      for (let i = 0; i < rows.length; i += 100) await table(tx, model.name).createMany({ data: rows.slice(i, i + 100) });
    }
    const violations = await tx.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
    if (violations.length) throw new Error("备份中存在失效关联，恢复已回滚，原数据保持不变");
  }, { timeout: 120_000 });
}
