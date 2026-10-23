import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentSegment, groupHabitsBySegment, habitSegment } from "./habit-segments";

describe("habit segments", () => {
  it("places habits by start time, then by name hints", () => {
    assert.equal(habitSegment({ name: "晨练", startTime: "07:30" }), "morning");
    assert.equal(habitSegment({ name: "组会", startTime: "11:00" }), "midday");
    assert.equal(habitSegment({ name: "创业", startTime: "15:00" }), "afternoon");
    assert.equal(habitSegment({ name: "睡前洗澡", startTime: "21:20" }), "evening");
    assert.equal(habitSegment({ name: "早睡 (22:30前)" }), "evening");
    assert.equal(habitSegment({ name: "早上洗漱" }), "morning");
    assert.equal(habitSegment({ name: "补剂" }), "anytime");
  });

  it("groups in day order and drops empty segments", () => {
    const groups = groupHabitsBySegment([
      { name: "深读书", startTime: "17:00", checked: false },
      { name: "整理房间", startTime: "07:00", checked: true },
      { name: "补剂", startTime: null, checked: false },
      { name: "收拾衣物", startTime: "07:15", checked: false },
    ]);
    assert.deepEqual(groups.map((g) => g.key), ["morning", "afternoon", "anytime"]);
    assert.deepEqual(groups[0].habits.map((h) => h.name), ["整理房间", "收拾衣物"]);
    assert.equal(groups[0].done, 1);
  });

  it("resolves the current segment from the clock", () => {
    assert.equal(currentSegment(new Date(2026, 8, 28, 8, 0)), "morning");
    assert.equal(currentSegment(new Date(2026, 8, 28, 12, 30)), "midday");
    assert.equal(currentSegment(new Date(2026, 8, 28, 22, 0)), "evening");
  });
});
