import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bedtimeDelayMinutes,
  blockWithinSleepRange,
  formatBedtimeDelay,
  parseSleepHours,
  sleepDurationHours,
  sleepWindowEnd,
} from "./sleep-window";

describe("sleep duration", () => {
  it("counts overnight hours from planned bedtime to wake", () => {
    assert.equal(sleepDurationHours("23:00", "07:00"), 8);
    assert.equal(sleepDurationHours("22:30", "06:40"), 8.2);
    assert.equal(sleepDurationHours("00:30", "07:00"), 6.5);
  });

  it("returns null until both clocks exist", () => {
    assert.equal(sleepDurationHours(null, "07:00"), null);
    assert.equal(sleepDurationHours("23:00", null), null);
    assert.equal(sleepDurationHours("07:00", "07:00"), 0);
  });
});

describe("typed sleep hours", () => {
  it("keeps a typed duration and waits on incomplete text", () => {
    assert.equal(parseSleepHours("7.5"), 7.5);
    assert.equal(parseSleepHours("8"), 8);
    assert.equal(parseSleepHours(""), null);
    assert.equal(parseSleepHours("7."), undefined);
    assert.equal(parseSleepHours("25"), undefined);
  });
});

describe("bedtime delay", () => {
  it("measures how much later than planned sleep the bedtime is", () => {
    assert.equal(bedtimeDelayMinutes("22:30", "23:10"), 40);
    assert.equal(bedtimeDelayMinutes("22:30", "00:00"), 90);
    assert.equal(bedtimeDelayMinutes("23:30", "00:20"), 50);
    assert.equal(formatBedtimeDelay(40), "晚于计划 40 分钟就寝");
    assert.equal(formatBedtimeDelay(70), "晚于计划 1 小时 10 分钟就寝");
    assert.equal(formatBedtimeDelay(60), "晚于计划 1 小时就寝");
  });

  it("says when bedtime matches or beats the plan", () => {
    assert.equal(bedtimeDelayMinutes("22:30", "22:30"), 0);
    assert.equal(bedtimeDelayMinutes("22:30", "22:10"), -20);
    assert.equal(formatBedtimeDelay(0), "按计划就寝");
    assert.equal(formatBedtimeDelay(-20), "早于计划 20 分钟就寝");
    assert.equal(bedtimeDelayMinutes(null, "23:00"), null);
    assert.equal(formatBedtimeDelay(null), null);
  });
});

describe("sleep window", () => {
  it("uses the evening bedtime when it is marked", () => {
    assert.equal(sleepWindowEnd("22:00", "22:40"), "22:40");
    assert.equal(sleepWindowEnd("22:00", null), "22:00");
    assert.equal(sleepWindowEnd(null, null), null);
  });

  it("keeps every block when no times are marked", () => {
    assert.equal(blockWithinSleepRange("06:00", "12:00", null, null), true);
    assert.equal(blockWithinSleepRange("22:30", "23:00", null, null), true);
  });

  it("keeps blocks that overlap wake through planned sleep", () => {
    assert.equal(blockWithinSleepRange("06:00", "12:00", "06:40", "22:00"), true);
    assert.equal(blockWithinSleepRange("10:30", "17:00", "06:40", "22:00"), true);
    assert.equal(blockWithinSleepRange("22:00", "22:10", "06:40", "22:00"), true);
    assert.equal(blockWithinSleepRange("22:30", "23:00", "06:40", "22:00"), false);
  });

  it("extends the range to the marked bedtime", () => {
    assert.equal(blockWithinSleepRange("22:00", "22:10", "06:40", "22:40"), true);
    assert.equal(blockWithinSleepRange("22:30", "23:00", "06:40", "22:40"), true);
  });

  it("treats a bedtime before wake as after midnight", () => {
    assert.equal(blockWithinSleepRange("23:30", "23:50", "07:00", "00:30"), true);
    assert.equal(blockWithinSleepRange("06:00", "06:30", "07:00", "00:30"), false);
  });
});
