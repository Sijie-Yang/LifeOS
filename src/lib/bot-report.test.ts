import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collectTomorrow, habitOpsFromReport, matchHabitName, parseBotReport, reportHasText, summarizeReports } from "./bot-report";

describe("parseBotReport", () => {
  it("normalizes a report", () => {
    const { report, error } = parseBotReport({ bot: "学习", done: ["C02", 3], proposed_ops: [] }, "2026-10-17");
    assert.equal(error, null);
    assert.deepEqual(report, { bot: "学习", date: "2026-10-17", done: ["C02"], habits: [], proposed_ops: [], blockers: [], needs_user: [], tomorrow: [] });
    assert.match(summarizeReports([report!]), /学习/);
  });
  it("rejects missing bot and bad proposed_ops", () => {
    assert.ok(parseBotReport({}, "2026-10-17").error);
    assert.ok(parseBotReport({ bot: "x", proposed_ops: {} }, "2026-10-17").error);
  });
});

describe("habitOpsFromReport", () => {
  const habits = [
    { id: "h1", name: "英语学习 · 每日包" },
    { id: "h2", name: "清晨科研" },
    { id: "h3", name: "咖啡 · 下午不喝" },
  ];
  it("maps habit names to check_habit, skipping ones already in proposed_ops", () => {
    const { report } = parseBotReport(
      { bot: "学习", habits: ["英语学习·每日包", "清晨科研", "冥想"], proposed_ops: [{ op: "check_habit", habitId: "h2" }] },
      "2026-10-18"
    );
    const { ops, errors } = habitOpsFromReport(report!, habits);
    assert.deepEqual(ops, [{ op: "check_habit", habitId: "h1" }]);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /冥想/);
  });
  it("matchHabitName handles unique substrings and refuses ambiguity", () => {
    assert.equal(matchHabitName("下午不喝", habits), "h3");
    assert.equal(matchHabitName("科", [{ id: "a", name: "科研" }, { id: "b", name: "科普" }]), null);
  });
  it("collects tomorrow items and detects text", () => {
    const { report } = parseBotReport({ bot: "research", tomorrow: ["交周报"] }, "2026-10-18");
    assert.deepEqual(collectTomorrow([report!]), [{ bot: "research", item: "交周报" }]);
    assert.equal(reportHasText(report!), true);
  });
});
