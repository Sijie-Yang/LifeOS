import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAlignPrompt, describeOp, extractOpsJson, parseAlignOps, type AlignContext } from "./align-ops";

describe("extractOpsJson", () => {
  it("reads a fenced json block out of an LLM reply", () => {
    const reply = '好的，整理如下：\n```json\n{ "ops": [{ "op": "check_habit", "habitId": "h1" }] }\n```\n有问题再说。';
    assert.deepEqual(extractOpsJson(reply), { ops: [{ op: "check_habit", habitId: "h1" }] });
  });

  it("accepts a bare array", () => {
    assert.deepEqual(extractOpsJson('[{"op":"complete_step","stepId":"s1"}]'), [{ op: "complete_step", stepId: "s1" }]);
  });
});

describe("parseAlignOps", () => {
  it("keeps valid ops and reports bad ones", () => {
    const { ops, errors } = parseAlignOps(
      {
        ops: [
          { op: "complete_step", stepId: "s1", note: "写完 intro" },
          { op: "log_work", projectId: "p1", title: "和导师过了 related work" },
          { op: "log_work", projectId: "p1" },
          { op: "archive_everything" },
        ],
      });
    assert.deepEqual(ops, [
      { op: "complete_step", stepId: "s1", note: "写完 intro" },
      { op: "log_work", projectId: "p1", title: "和导师过了 related work" },
    ]);
    assert.equal(errors.length, 2);
    assert.match(errors[1]!, /不支持的操作：archive_everything/);
  });

  it("normalises rhythm and validates power", () => {
    const { ops, errors } = parseAlignOps(
      [
        { op: "set_rhythm", projectId: "p1", workdays: [5, 1, 3, 3, 9] },
        { op: "set_power", projectId: "p1", power: "action" },
        { op: "set_power", projectId: "p2", power: "nope" },
      ]);
    assert.deepEqual(ops, [
      { op: "set_rhythm", projectId: "p1", workdays: [1, 3, 5] },
      { op: "set_power", projectId: "p1", power: "action" },
    ]);
    assert.equal(errors.length, 1);
  });
});

describe("undo ops", () => {
  it("parses uncomplete_step, uncheck_habit and remove_step", () => {
    const { ops, errors } = parseAlignOps([
      { op: "uncomplete_step", stepId: "s1" },
      { op: "uncheck_habit", habitId: "h1" },
      { op: "remove_step", stepId: "s2" },
      { op: "remove_step" },
    ]);
    assert.deepEqual(ops, [
      { op: "uncomplete_step", stepId: "s1" },
      { op: "uncheck_habit", habitId: "h1" },
      { op: "remove_step", stepId: "s2" },
    ]);
    assert.equal(errors.length, 1);
  });
});

describe("buildAlignPrompt", () => {
  const ctx: AlignContext = {
    date: "2026-10-12",
    mode: "daily",
    todaySteps: [{ stepId: "s1", projectId: "p1", projectName: "Thesis", title: "写 related work", done: false }],
    habits: [{ habitId: "h1", name: "游泳", power: "vitality", checked: false }],
    projects: [
      {
        projectId: "p1",
        name: "Thesis",
        category: "Research",
        power: "action",
        planActive: true,
        workdays: [1, 2, 3, 4, 5],
        done: 3,
        total: 16,
        doneThisWeek: 1,
        lastDoneDate: "2026-10-09",
        upcoming: [{ stepId: "s1", title: "写 related work", date: "2026-10-12" }],
      },
    ],
  };

  it("lists today's steps, habits and projects with their ids", () => {
    const prompt = buildAlignPrompt(ctx);
    assert.match(prompt, /stepId=s1 · Thesis · 写 related work/);
    assert.match(prompt, /habitId=h1 · 游泳（活力）/);
    assert.match(prompt, /projectId=p1 · Thesis（Research） · 行动力 · 周一二三四五/);
    assert.match(prompt, /自动顺延/);
    assert.doesNotMatch(prompt, /set_rhythm/);
  });

  it("adds project rhythm operations in projects mode", () => {
    const prompt = buildAlignPrompt({ ...ctx, mode: "projects" });
    assert.match(prompt, /set_rhythm/);
    assert.match(prompt, /进度 3\/16 · 本周完成 1/);
  });
});

describe("create ops (bot integration)", () => {
  it("parses create_project and create_habit", () => {
    const { ops, errors } = parseAlignOps([
      { op: "create_project", name: "Side Project", workdays: [1, 2, 3, 4, 5, 9] },
      { op: "create_habit", name: "阅读 · 每日 20 分钟", schedule: "anytime", projectName: "Reading", power: "learning" },
    ]);
    assert.deepEqual(errors, []);
    assert.deepEqual(ops[0], { op: "create_project", name: "Side Project", workdays: [1, 2, 3, 4, 5] });
    assert.deepEqual(ops[1], { op: "create_habit", name: "阅读 · 每日 20 分钟", schedule: "anytime", projectName: "Reading", power: "learning" });
  });

  it("refuses description and bad fields", () => {
    const { ops, errors } = parseAlignOps([
      { op: "create_project", name: "X", description: "nope" },
      { op: "create_project" },
      { op: "create_habit", name: "Y", power: "bogus" },
    ]);
    assert.equal(ops.length, 0);
    assert.equal(errors.length, 3);
  });
});

describe("day / close ops", () => {
  it("parses plan, must-do, day log, notes, extras, close, tasks and week review", () => {
    const { ops, errors } = parseAlignOps([
      { op: "set_day_plan", intention: "交 基金申请", priorities: ["基金申请 材料", { title: "第 2 章", projectId: "p1" }] },
      { op: "set_must_do", items: [{ type: "habit", id: "h1" }, { type: "priority", title: "算法题 1 道" }] },
      { op: "update_day_log", set: { energyEvening: 3, drainEvening: 2, sleepTime: "22:30", reflection: "还行", weightKg: 65 } },
      { op: "record_note", kind: "step", id: "s1", text: "没做：开会拖了" },
      { op: "add_extra", title: "陪朋友参观展览" },
      { op: "close_day", note: "今天 6/10" },
      { op: "create_task", set: { title: "交伦理审批", dueDate: "2026-10-20", priority: "HIGH" } },
      { op: "complete_task", taskId: "t1" },
      { op: "set_week_plan", priorities: ["A"] },
      { op: "set_week_review", set: { wins: "申请材料交了", nextFocus: "基金申请" } },
      { op: "save_bot_digest", content: "## research" },
    ]);
    assert.deepEqual(errors, []);
    assert.equal(ops.length, 11);
    assert.deepEqual(ops[0], { op: "set_day_plan", intention: "交 基金申请", priorities: [{ title: "基金申请 材料" }, { title: "第 2 章", projectId: "p1" }] });
    assert.deepEqual((ops[2] as { set: unknown }).set, { energyEvening: 3, drainEvening: 2, sleepTime: "22:30", reflection: "还行", weightKg: 65 });
  });
  it("rejects bad values", () => {
    const { ops, errors } = parseAlignOps([
      { op: "set_day_plan", priorities: ["a", "b", "c", "d"] },
      { op: "set_day_plan" },
      { op: "update_day_log", set: { energyEvening: 9 } },
      { op: "update_day_log", set: { timeFills: "{}" } },
      { op: "update_day_log", set: { sleepTime: "25:00" } },
      { op: "record_note", kind: "goal", id: "x", text: "y" },
      { op: "create_task", set: { title: "x", dueDate: "tomorrow" } },
      { op: "set_must_do", items: [{ type: "note", id: "x" }] },
      { op: "save_bot_digest", content: "" },
    ]);
    assert.equal(ops.length, 0);
    assert.equal(errors.length, 9);
  });
  it("describes close ops in plain words", () => {
    const names = { step: () => "示例机构 · 核对年份", project: () => null, habit: () => null, task: () => "交伦理审批" };
    assert.equal(describeOp({ op: "close_day", note: "收工" }, names), "关账：收工");
    assert.match(describeOp({ op: "record_note", kind: "step", id: "s", text: "没做" }, names), /示例机构/);
    assert.equal(describeOp({ op: "complete_task", taskId: "t" }, names), "完成任务：交伦理审批");
  });
});
