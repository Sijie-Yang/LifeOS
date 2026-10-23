import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { startEventTimer, updateEventTimer, timerDto } from "../src/lib/event-timer-service";
import { timerElapsedSeconds, effectiveTimerStatus, allocateTimerSlots } from "../src/lib/event-timers";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lifeos-timer-test-"));
  const database = path.join(dir, "test.db");
  fs.closeSync(fs.openSync(database, "a"));
  const url = `file:${database}?connection_limit=1`;
  const initialized = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: url}, encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);
  const client = new PrismaClient({ datasourceUrl: url });
  try {
    const task = await client.taskItem.create({ data: { title: "论文 fixture" } });
    const other = await client.taskItem.create({ data: { title: "跑步 fixture" } });
    const base = +new Date("2026-10-08T09:00:00");
    const body = { eventId: `task:${task.id}`, requestId: "request-fixture-000001", mode: "fixed", minutes: 25, category: "research", autoAllocate: true };
    const first = await startEventTimer(client, body, base);
    assert.equal((await startEventTimer(client, body, base + 100)).id, first.id);
    assert.equal((await startEventTimer(client, { ...body, requestId: "request-fixture-000002" }, base + 200)).id, first.id);
    assert.equal(await client.eventTimer.count(), 1);
    const [parallelA, parallelB] = await Promise.all([
      startEventTimer(client, { ...body, eventId: `task:${other.id}`, requestId: "request-fixture-000003", mode: "free", category: "move" }, base + 5 * 60_000),
      startEventTimer(client, { ...body, eventId: `task:${other.id}`, requestId: "request-fixture-000004", mode: "free", category: "move" }, base + 5 * 60_000),
    ]);
    assert.equal(parallelA.id, parallelB.id);
    const paused = await updateEventTimer(client, first.id, { action: "pause" }, base + 10 * 60_000);
    assert.equal(timerElapsedSeconds(paused, base + 60 * 60_000), 600);
    const resumed = await updateEventTimer(client, first.id, { action: "resume" }, base + 20 * 60_000);
    assert.equal(effectiveTimerStatus(resumed, base + 60 * 60_000), "completed");
    assert.equal(timerElapsedSeconds(resumed, base + 60 * 60_000), 1500);
    const settled = await updateEventTimer(client, first.id, { action: "stop" }, base + 60 * 60_000);
    assert.equal(settled.endedAt, new Date(base + 35 * 60_000).toISOString());
    const repeatedStop = await updateEventTimer(client, first.id, { action: "stop" }, base + 90 * 60_000);
    assert.deepEqual(repeatedStop, settled);
    const next = await startEventTimer(client, { ...body, requestId: "request-fixture-000005" }, base + 70 * 60_000);
    assert.notEqual(next.id, first.id);
    const cancelled = await updateEventTimer(client, next.id, { action: "cancel" }, base + 71 * 60_000);
    assert.equal(timerElapsedSeconds(cancelled, base + 90 * 60_000), 0);
    const revised = await updateEventTimer(client, first.id, { action: "settings", category: "learning", autoAllocate: false }, base + 90 * 60_000);
    assert.deepEqual(allocateTimerSlots([revised], "2026-10-08", base + 90 * 60_000), {});
    await client.taskItem.delete({ where: { id: task.id } });
    assert.equal(timerDto((await client.eventTimer.findUniqueOrThrow({ where: { id: first.id } }))).title, "论文 fixture");
    await assert.rejects(() => startEventTimer(client, { ...body, requestId: "request-fixture-000006" }, base));
    await assert.rejects(() => startEventTimer(client, { ...body, minutes: -1 }, base));
    await assert.rejects(() => updateEventTimer(client, first.id, { action: "settings", category: "unknown" }, base));
    console.log("PASS: idempotent starts/stops, concurrent start deduplication, parallel timers, pause/resume, fixed offline deadline, cancellation, category edits, source deletion and validation.");
  } finally { await client.$disconnect(); fs.rmSync(dir, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
