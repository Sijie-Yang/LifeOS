import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateTimerSlots, effectiveTimerStatus, suggestTimerCategory, timerElapsedSeconds, type EventTimerDto } from "./event-timers";
const at = (time: string) => new Date(`2026-10-08T${time}:00`).toISOString();
function timer(patch: Partial<EventTimerDto> = {}): EventTimerDto {
  return { id: "one", eventId: "task:one", eventKind: "task", title: "论文", href: "/tasks", projectName: null, mode: "free", category: "research", autoAllocate: true,
    status: "running", durationSeconds: null, startedAt: at("09:00"), runningSince: at("09:00"), endedAt: null, segments: [], ...patch };
}
test("parallel intervals split occupied time without double-counting", () => {
  const fills = allocateTimerSlots([timer(), timer({ id: "two", category: "move", runningSince: at("09:15") })], "2026-10-08", Date.parse(at("09:30")));
  assert.deepEqual(fills["09:00"], [{ category: "research", seconds: 1350 }, { category: "move", seconds: 450 }]);
  assert.equal(fills["09:00"].reduce((n, a) => n + a.seconds, 0), 1800);
});
test("pauses exclude gaps and fixed timers cap their budget after resuming offline", () => {
  const t = timer({ mode: "fixed", durationSeconds: 1500, segments: [{ start: at("09:00"), end: at("09:10") }], runningSince: at("10:00") });
  assert.equal(timerElapsedSeconds(t, Date.parse(at("11:00"))), 1500);
  assert.equal(effectiveTimerStatus(t, Date.parse(at("11:00"))), "completed");
  const fills = allocateTimerSlots([t], "2026-10-08", Date.parse(at("11:00")));
  assert.deepEqual(Object.keys(fills), ["09:00", "10:00"]);
  assert.equal(fills["10:00"][0].seconds, 900);
});
test("cross-midnight timers allocate only each day's intersecting interval", () => {
  const t = timer({ startedAt: at("23:45"), runningSince: at("23:45") });
  const end = +new Date("2026-10-09T00:15:00");
  assert.equal(allocateTimerSlots([t], "2026-10-08", end)["23:30"][0].seconds, 900);
  assert.equal(allocateTimerSlots([t], "2026-10-09", end)["00:00"][0].seconds, 900);
});
test("cancelled and opted-out timers do not allocate; paused timers retain finished spans", () => {
  const end = Date.parse(at("10:00"));
  assert.deepEqual(allocateTimerSlots([timer({ status: "cancelled" }), timer({ autoAllocate: false })], "2026-10-08", end), {});
  const paused = timer({ status: "paused", runningSince: null, segments: [{ start: at("09:00"), end: at("09:10") }] });
  assert.equal(timerElapsedSeconds(paused, end), 600);
  assert.equal(effectiveTimerStatus(paused, end), "paused");
});
test("category hints follow explicit activity words before generic meeting defaults", () => {
  assert.equal(suggestTimerCategory({ kind: "meeting", title: "论文讨论" }), "research");
  assert.equal(suggestTimerCategory({ kind: "contact", title: "联系朋友" }), "social");
  assert.equal(suggestTimerCategory({ kind: "routine", title: "跑步" }), "move");
  assert.equal(suggestTimerCategory({ kind: "task", title: "未分类任务" }), "life");
});
