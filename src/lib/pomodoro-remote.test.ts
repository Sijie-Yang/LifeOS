import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  currentAndNextBlocks,
  parsePomodoroCommand,
  parseTimerState,
  localNow,
  timerRemainingSec,
} from "./pomodoro-remote";

describe("parsePomodoroCommand", () => {
  it("accepts JSON strings and objects", () => {
    assert.deepEqual(parsePomodoroCommand('{"type":"pause","nonce":"a"}'), { type: "pause", nonce: "a" });
    assert.deepEqual(parsePomodoroCommand({ type: "start", habitId: "h1", nonce: "b" }), {
      type: "start",
      habitId: "h1",
      nonce: "b",
    });
  });

  it("rejects unknown types, missing nonce and start without habit", () => {
    assert.equal(parsePomodoroCommand({ type: "explode", nonce: "a" }), null);
    assert.equal(parsePomodoroCommand({ type: "pause" }), null);
    assert.equal(parsePomodoroCommand({ type: "start", nonce: "a" }), null);
    assert.equal(parsePomodoroCommand("not json"), null);
    assert.equal(parsePomodoroCommand(null), null);
  });
});

describe("timerRemainingSec", () => {
  const base = {
    sessionId: "s",
    habitId: "h",
    habitName: "研究",
    habitColor: "#f00",
    phase: "work" as const,
    completedWorkCount: 0,
    date: "2026-10-23",
    distractions: 0,
  };

  it("counts down to endsAt while running", () => {
    assert.equal(timerRemainingSec({ ...base, endsAt: 61_000, pausedAt: null, remainingMs: 0 }, 1_000), 60);
    assert.equal(timerRemainingSec({ ...base, endsAt: 1_000, pausedAt: null, remainingMs: 0 }, 5_000), 0);
  });

  it("freezes on remainingMs while paused", () => {
    assert.equal(timerRemainingSec({ ...base, endsAt: 0, pausedAt: 1, remainingMs: 90_500 }, 999_999), 91);
  });
});

describe("parseTimerState", () => {
  const raw = (o: object) => JSON.stringify({ phase: "work", endsAt: 10_000, pausedAt: null, remainingMs: 0, ...o });

  it("keeps running, paused and overdue work timers", () => {
    assert.equal(parseTimerState(raw({}), 5_000)?.phase, "work");
    assert.equal(parseTimerState(raw({}), 50_000)?.phase, "work");
    assert.ok(parseTimerState(raw({ phase: "short_break", pausedAt: 1 }), 50_000));
  });

  it("drops finished breaks and junk", () => {
    assert.equal(parseTimerState(raw({ phase: "short_break" }), 50_000), null);
    assert.equal(parseTimerState("{oops", 0), null);
    assert.equal(parseTimerState(null, 0), null);
  });
});

describe("localNow", () => {
  it("formats the local date and minute", () => {
    assert.deepEqual(localNow(new Date(2026, 9, 23, 7, 5, 59)), { date: "2026-10-23", time: "07:05" });
  });
});

describe("currentAndNextBlocks", () => {
  const blocks = [
    { id: "c", startTime: "06:00", endTime: "12:00" },
    { id: "a", startTime: "06:30", endTime: "08:00" },
    { id: "b", startTime: "09:00", endTime: "10:00" },
  ];

  it("returns overlapping blocks (latest start first) and the next one", () => {
    const { current, next } = currentAndNextBlocks(blocks, "07:00");
    assert.deepEqual(current.map((b) => b.id), ["a", "c"]);
    assert.equal(next?.id, "b");
  });

  it("treats endTime as exclusive and handles the end of the day", () => {
    const { current, next } = currentAndNextBlocks(blocks, "12:00");
    assert.deepEqual(current, []);
    assert.equal(next, null);
  });
});
