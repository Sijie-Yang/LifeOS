import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDayReviewPrompt, missingReasons, type DayReviewInput } from "./day-review";
import { parsePlanScore, parseRecordExtras, parseRecordNotes, setRecordNote } from "./day-record";
import { bucketTrend, clockHours, formatClockHours, trendDates, type TrendDay } from "./day-trend";
import { describeWellness } from "./wellness-scores";
import { parseAlignOps } from "./align-ops";

const input: DayReviewInput = {
  date: "2026-10-10",
  closed: false,
  wellness: {
    lastNightBedtime: "23:30",
    wakeTime: "07:00",
    sleepHours: 7.5,
    energyMorning: 4,
    drainMorning: 2,
    energyEvening: null,
    drainEvening: null,
    reflection: "主线推进了",
  },
  steps: [
    { id: "s1", title: "写 related work", projectId: "p1", projectName: "示例论文", done: true },
    { id: "s2", title: "跑 baseline", projectId: "p1", projectName: "示例论文", done: false },
  ],
  tasks: [],
  habits: [
    { id: "h1", name: "游泳", checked: false, power: "vitality" },
    { id: "h2", name: "洗澡", checked: false, power: "base" },
  ],
  notes: { "step:s1": "顺手把 intro 也改了", "step:s2": "GPU 被占" },
  extras: [{ id: "x1", title: "和导师过了选题" }],
  lifePowers: null,
  planScore: null,
};

describe("day review", () => {
  it("requires a reason for every missed non-base item", () => {
    assert.deepEqual(missingReasons(input), ["游泳"]);
  });

  it("puts notes, extras, ids and the scoring op into the prompt", () => {
    const prompt = buildDayReviewPrompt(input);
    assert.match(prompt, /stepId=s1\] 示例论文 · 写 related work\n  - 多做了：顺手把 intro 也改了/);
    assert.match(prompt, /stepId=s2 · projectId=p1\] 示例论文 · 跑 baseline\n  - 原因：GPU 被占/);
    assert.match(prompt, /- 和导师过了选题/);
    assert.match(prompt, /早上精力：4 · 良好/);
    assert.match(prompt, /set_day_score/);
    assert.match(prompt, /src\/lib\/day-review\.ts/);
  });
});

describe("day record", () => {
  it("parses notes and extras defensively", () => {
    assert.deepEqual(parseRecordNotes('{"step:a":" x ","bad":"y","task:b":""}'), { "step:a": "x" });
    assert.deepEqual(parseRecordExtras('[{"id":"1","title":"a"},{"id":2,"title":"b"}]'), [{ id: "1", title: "a" }]);
    assert.deepEqual(setRecordNote({ "step:a": "x" }, "step:a", "  "), {});
    assert.equal(parsePlanScore("87.4"), 87);
    assert.equal(parsePlanScore(120), null);
  });
});

describe("day trend", () => {
  it("averages a year into weeks, ignoring empty days", () => {
    const dates = trendDates("year", "2026-10-11");
    assert.equal(dates.length, 364);
    const days: TrendDay[] = dates.map((date, i) => ({
      date,
      sleepHours: i % 2 ? 8 : null,
      energyMorning: null,
      energyEvening: null,
      drainMorning: null,
      drainEvening: null,
      habitRate: 50,
      planScore: null,
      bedtime: null,
      wakeTime: null,
      weightKg: null,
      exerciseStart: null,
      exerciseMinutes: null,
      exerciseCalories: null,
      urgeMorning: null,
      urgeCount: null,
      transferRate: null,
      keptRate: null,
      focusMinutes: null,
    }));
    const points = bucketTrend("year", days);
    assert.equal(points.length, 52);
    assert.equal(points[0]!.sleepHours, 8);
    assert.equal(points[0]!.planScore, null);
  });
});

describe("wellness scale + new align ops", () => {
  it("describes each score", () => {
    assert.equal(describeWellness("drain", 5)?.startsWith("5 · 严重"), true);
    assert.equal(describeWellness("energy", null), null);
  });

  it("parses set_day_score and set_habit_power", () => {
    const { ops, errors } = parseAlignOps([
      { op: "set_day_score", score: 78, note: "主线完成" },
      { op: "set_day_score", score: 150 },
      { op: "set_habit_power", habitId: "h1", power: "base" },
    ]);
    assert.deepEqual(ops, [
      { op: "set_day_score", score: 78, note: "主线完成" },
      { op: "set_habit_power", habitId: "h1", power: "base" },
    ]);
    assert.equal(errors.length, 1);
  });
});

describe("clock hours", () => {
  it("keeps bedtimes after midnight next to the evening", () => {
    assert.equal(clockHours("23:30", true), 23.5);
    assert.equal(clockHours("01:30", true), 25.5);
    assert.equal(clockHours("07:15", false), 7.25);
    assert.equal(clockHours(null, true), null);
    assert.equal(formatClockHours(25.5), "01:30");
    assert.equal(formatClockHours(7.25), "07:15");
  });
});

describe("urge transfer", () => {
  it("counts transfer days only when there was no relapse that day", async () => {
    const { transferDates, keptStreak } = await import("./urge-transfer");
    const events = [
      { date: "2026-10-08", outcome: "redirected", redirect: "outside" },
      { date: "2026-10-09", outcome: "surfed" },
      { date: "2026-10-09", outcome: "gave_in" },
      { date: "2026-10-10", outcome: "redirected", redirect: "exercise" },
    ];
    assert.deepEqual(transferDates(events).sort(), ["2026-10-08", "2026-10-10"]);
    // 10-09 破戒 → 只算 10-10
    assert.equal(keptStreak({ today: "2026-10-10", events, recordedDates: ["2026-10-07"] }), 1);
    // 今天还没记录：从昨天开始数
    assert.equal(
      keptStreak({ today: "2026-10-12", events: [], recordedDates: ["2026-10-09", "2026-10-10", "2026-10-11"] }),
      3
    );
  });

  it("puts the urge summary into the review prompt", () => {
    const prompt = buildDayReviewPrompt({
      ...input,
      urge: { morning: 4, today: [{ time: "14:20", label: "出门", outcome: "redirected", trigger: "无聊" }], streak: 5, brokeToday: false },
    });
    assert.match(prompt, /冲动强度（早）：4 · 强烈/);
    assert.match(prompt, /1 次冲动：14:20 出门（无聊） · 守住 · 连续守住 5 天/);
  });
});

describe("room cleaning ticks", () => {
  it("toggles done zones, bumps the zone score and tracks last-cleaned dates", async () => {
    const { toggleRoomDone, parseRoomDone, markZoneCleaned, roomLastDone } = await import("./room-plan");
    assert.deepEqual(toggleRoomDone([], "bed", true), ["bed"]);
    assert.deepEqual(toggleRoomDone(["bed", "desk"], "bed", false), ["desk"]);
    assert.deepEqual(toggleRoomDone([], "nope", true), []);
    assert.deepEqual(parseRoomDone('["bed","x","bed"]'), ["bed"]);
    assert.deepEqual(markZoneCleaned({ bed: 1 }, "bed"), { bed: 4 });
    assert.deepEqual(markZoneCleaned({ bed: 5 }, "bed"), { bed: 5 });
    assert.deepEqual(
      roomLastDone([
        { date: "2026-10-09", roomDone: '["bed","desk"]' },
        { date: "2026-10-11", roomDone: '["bed"]' },
      ]),
      { bed: "2026-10-11", desk: "2026-10-09" }
    );
  });
});
