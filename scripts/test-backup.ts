/** Integration test: exclusively uses a newly created temporary SQLite database. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Prisma, PrismaClient } from "@prisma/client";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lifeos-backup-test-"));
  const database = path.join(dir, "test.db");
  fs.closeSync(fs.openSync(database, "a"));
  process.env.DATABASE_URL = `file:${database}?connection_limit=1`;
  const initialized = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env: process.env, encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);
  const client = new PrismaClient();
  const { prisma } = await import("../src/lib/prisma");
  const { exportFullBackup, restoreFromBackup } = await import("../src/lib/backup-restore");
  try {
    const models = Prisma.dmmf.datamodel.models;
    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const model of models) {
      const row: Record<string, unknown> = {};
      for (const f of model.fields.filter((field) => field.kind !== "object")) {
        row[f.name] = f.type === "String" ? `${model.name}-${f.name}` : f.type === "DateTime" ? "2026-10-08T00:00:00.000Z" : f.type === "Boolean" ? true : 2;
        if (f.hasDefaultValue && (typeof f.default === "string" || typeof f.default === "number" || typeof f.default === "boolean")) row[f.name] = f.default;
      }
      row.id = `fixture-${model.name}`;
      for (const relation of model.fields.filter((f) => f.kind === "object" && f.relationFromFields?.length)) {
        for (const foreignKey of relation.relationFromFields!) row[foreignKey] = `fixture-${relation.type}`;
      }
      tables[model.name] = [row];
    }
    const fixture = { format: "lifeos", version: "2.0", exportedAt: "2026-10-08T00:00:00.000Z", tables };
    await restoreFromBackup(fixture, client);
    const before = await exportFullBackup(client);
    assert.equal(Object.keys(before.tables).length, models.length);
    for (const model of models) assert.equal(before.tables[model.name].length, 1, model.name);
    await client.note.create({ data: { title: "remove on restore", content: "temporary" } });
    await restoreFromBackup(before, client);
    assert.deepEqual((await exportFullBackup(client)).tables, before.tables, "all fields and relations round-trip");
    for (const invalid of [{}, { version: "1.5" }, { ...before, tables: {} }]) {
      await assert.rejects(() => restoreFromBackup(invalid, client));
      assert.deepEqual((await exportFullBackup(client)).tables, before.tables);
    }
    const broken = structuredClone(before);
    broken.tables.GoalContact[0].contactId = "missing-contact";
    await assert.rejects(() => restoreFromBackup(broken, client));
    assert.deepEqual((await exportFullBackup(client)).tables, before.tables, "foreign-key failure rolls back every table");
    const duplicate = structuredClone(before);
    duplicate.tables.Contact.push({ ...duplicate.tables.Contact[0] });
    await assert.rejects(() => restoreFromBackup(duplicate, client));
    assert.deepEqual((await exportFullBackup(client)).tables, before.tables);
    console.log(`PASS: ${models.length} models round-trip, invalid/legacy/incomplete/duplicate input rejected, broken relations fully rolled back.`);
  } finally {
    await client.$disconnect();
    await prisma.$disconnect();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
