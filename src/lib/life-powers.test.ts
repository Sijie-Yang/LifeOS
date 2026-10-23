import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeLifePowers,
  pickUrgentMustDos,
  suggestHabitPower,
  type LifePowersContext,
} from "./life-powers";
import { habitScheduleLabel } from "./reminders";

function ctx(overrides: Partial<LifePowersContext> = {}): LifePowersContext {
  return {
    date: "2026-10-10",
    habits: [],
    lockedHabits: [],
    habitHistory: [],
    planStepsToday: [],
    stepHistory: [],
    projects: [],
    meetings: [],
    lastSocialDate: null,
    contactLogsToday: 0,
    tasks: [],
    opportunities: [],
    lastLinkDate: null,
    ...overrides,
  };
}

const step = (id: string, title: string, projectName: string, projectPower: string | null, done = false) => ({
  id,
  title,
  detail: null,
  done,
  projectName,
  projectPower,
});

describe("suggestHabitPower", () => {
  it("suggests a power or the base bucket for new habits", () => {
    assert.equal(suggestHabitPower("整理房间"), "clean");
    assert.equal(suggestHabitPower("游泳"), "vitality");
    assert.equal(suggestHabitPower("独处冥想 15 分钟"), "calm");
    assert.equal(suggestHabitPower("维护 networking 关系"), "social");
    assert.equal(suggestHabitPower("早上洗漱"), "base");
    assert.equal(suggestHabitPower("咖啡 · 下午不喝"), "base");
    assert.equal(suggestHabitPower("交水电费"), null);
  });
});

describe("computeLifePowers", () => {
  it("returns nine powers split into body and group", () => {
    const result = computeLifePowers(ctx());
    assert.equal(result.dimensions.length, 9);
    assert.deepEqual(
      result.dimensions.filter((d) => d.group === "group").map((d) => d.label),
      ["链接力", "机会力", "组织力"]
    );
  });

  it("uses the locked habit power, never the habit name", () => {
    const result = computeLifePowers(
      ctx({ habits: [{ id: "h1", name: "整理房间", checked: true, power: "calm" }] })
    );
    const calm = result.dimensions.find((d) => d.key === "calm")!;
    const clean = result.dimensions.find((d) => d.key === "clean")!;
    assert.deepEqual(calm.todayLevers.map((l) => l.id), ["h1"]);
    assert.equal(calm.level, "ok");
    assert.equal(calm.summary, "今日已独处 · 本周 1/7");
    assert.equal(clean.todayLevers.length, 0);
  });

  it("keeps base habits out of the nine powers and the event count", () => {
    const result = computeLifePowers(
      ctx({
        habits: [
          { id: "b1", name: "早上洗漱", checked: true, power: "base" },
          { id: "h1", name: "新习惯", checked: false, power: null },
        ],
      })
    );
    assert.deepEqual(result.base, { done: 1, total: 1 });
    assert.equal(result.eventTotal, 1);
    assert.deepEqual(result.unmatched.map((u) => u.label), ["习惯未锁定 · 新习惯"]);
  });

  it("only counts steps and tasks of projects selected into a power", () => {
    const result = computeLifePowers(
      ctx({
        planStepsToday: [step("s1", "写 related work", "示例论文", "action"), step("s2", "整理数据", "EV", null)],
        tasks: [{ id: "t1", title: "联系导师", completed: false, projectPower: null }],
      })
    );
    assert.deepEqual(result.dimensions.find((d) => d.key === "action")!.todayLevers.map((l) => l.id), ["s1"]);
    assert.deepEqual(result.unmatched.map((u) => u.id), ["s2", "t1"]);
    assert.equal(result.eventMatched, 1);
  });

  it("counts learning steps inside selected projects toward 学习力 too", () => {
    const result = computeLifePowers(
      ctx({ planStepsToday: [step("s1", "学习封面排版", "Personal Branding", "influence")] })
    );
    assert.deepEqual(result.dimensions.find((d) => d.key === "influence")!.todayLevers.map((l) => l.id), ["s1"]);
    assert.deepEqual(result.dimensions.find((d) => d.key === "learning")!.todayLevers.map((l) => l.label), [
      "学习封面排版 → Personal Branding",
    ]);
  });

  it("shows selected project progress as growth", () => {
    const result = computeLifePowers(
      ctx({ projects: [{ id: "p1", name: "Morning_Run", power: "vitality", done: 2, total: 40 }] })
    );
    assert.deepEqual(result.dimensions.find((d) => d.key === "vitality")!.growth, [
      { name: "Morning_Run", done: 2, total: 40 },
    ]);
  });

  it("picks urgent must-dos from critical powers", () => {
    const result = computeLifePowers(
      ctx({ habits: [{ id: "h2", name: "冥想", checked: false, power: "calm" }] })
    );
    assert.equal(pickUrgentMustDos(result).some((m) => m.id === "h2"), true);
  });
});

describe("weekly habits", () => {
  it("count history even on days they are not scheduled", () => {
    const result = computeLifePowers(
      ctx({
        habits: [],
        lockedHabits: [{ id: "h-meet", power: "organize" }],
        habitHistory: [{ habitId: "h-meet", date: "2026-10-05", level: "full" }],
      })
    );
    const organize = result.dimensions.find((d) => d.key === "organize")!;
    assert.equal(organize.summary, "5 天未带团队 · 本周 1/7");
  });
});

describe("habitScheduleLabel", () => {
  it("describes which days a habit runs", () => {
    assert.equal(habitScheduleLabel({ daysOfWeek: "[0,1,2,3,4,5,6]" }), "每天");
    assert.equal(habitScheduleLabel({ daysOfWeek: "[0,2,4]" }), "每周二、四、日");
    assert.equal(habitScheduleLabel({ daysOfWeek: "[1]" }), "每周一");
    assert.equal(habitScheduleLabel({ daysOfWeek: "[1,2,3,4,5]" }), "工作日");
    assert.equal(habitScheduleLabel({ daysOfWeek: "[0,6]" }), "周末");
    assert.equal(habitScheduleLabel({ daysOfWeek: "[1]", scheduleMode: "monthly", monthDays: "[15,1]" }), "每月 1、15 号");
  });
});
