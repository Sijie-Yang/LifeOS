import assert from "node:assert/strict";
import { test } from "node:test";
import { BACKUP_MODELS, validateFullBackup } from "./backup-format";
const empty = () => ({ format: "lifeos", version: "2.0", exportedAt: "2026-10-08T00:00:00Z", tables: Object.fromEntries(BACKUP_MODELS.map((m) => [m.name, []])) });
test("restore rejects empty objects, arrays, legacy and incomplete backups before writing", () => {
  for (const bad of [{}, [], null, {version:"1.5",contacts:[]}, {...empty(),tables:{}}]) assert.throws(()=>validateFullBackup(bad));
  assert.doesNotThrow(()=>validateFullBackup(empty()));
});
test("backup covers every model and rejects wrong field types", () => {
  const data=empty();
  for (const name of ["AppSettings","DailyPlan","WeeklyPlan","LibraryDocument","Recipe","HealthTip","LifeRecord","ChecklistRun","UrgeEvent","TimelineOverride","GoalContact"]) assert.ok(name in data.tables);
  data.tables.Contact = [{id:"a",name:123}] as never;
  assert.throws(()=>validateFullBackup(data));
});

test("complete pre-timer 2.0 backups gain an empty EventTimer table without mutating input", () => {
  const data = empty();
  delete data.tables.EventTimer;
  const result = validateFullBackup(data);
  assert.deepEqual(result.tables.EventTimer, []);
  assert.equal("EventTimer" in data.tables, false);
  delete data.tables.Contact;
  assert.throws(() => validateFullBackup(data));
});
