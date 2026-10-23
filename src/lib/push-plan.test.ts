import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planPushes, type PushInput } from "./push-plan";

const base: PushInput = {
  today: "2026-10-11", now: "07:00", timersDone: [], meetings: [], blocks: [],
  tasksDue: [], deadlines: [], stepsToday: 5, closed: false,
};

describe("push plan", () => {
  it("pushes a finished timer", () => {
    const p = planPushes({ ...base, timersDone: [{ id: "t1", title: "洗衣服", minutes: 45 }] });
    assert.equal(p[0]!.key, "timer:t1");
    assert.match(p[0]!.title, /洗衣服 · 时间到/);
  });

  it("warns 10 minutes before meetings and blocks, not earlier or after", () => {
    const meetings = [{ id: "m1", title: "组会", time: "14:00" }];
    assert.equal(planPushes({ ...base, now: "13:50", meetings }).filter((x) => x.key === "meeting:m1").length, 1);
    assert.equal(planPushes({ ...base, now: "13:40", meetings }).some((x) => x.key === "meeting:m1"), false);
    assert.equal(planPushes({ ...base, now: "14:00", meetings }).some((x) => x.key === "meeting:m1"), false);
  });

  it("sends the morning summary from 08:00 with due tasks and near deadlines", () => {
    assert.equal(planPushes(base).some((x) => x.key === "morning"), false);
    const m = planPushes({
      ...base,
      now: "08:00",
      tasksDue: [{ title: "回邮件", dueDate: "2026-10-11" }, { title: "交表", dueDate: "2026-10-09" }],
      deadlines: [{ title: "奖学金申请", deadline: "2026-10-13" }, { title: "远的", deadline: "2026-11-30" }],
    }).find((x) => x.key === "morning")!;
    assert.match(m.message, /今天到期：回邮件/);
    assert.match(m.message, /已过期：交表/);
    assert.match(m.message, /奖学金申请（2 天后）/);
    assert.doesNotMatch(m.message, /远的/);
    assert.equal(m.priority, 4);
  });

  it("sends the evening wrap-up only if the day is not closed", () => {
    assert.equal(planPushes({ ...base, now: "21:05" }).some((x) => x.key === "evening"), true);
    assert.equal(planPushes({ ...base, now: "21:05", closed: true }).some((x) => x.key === "evening"), false);
  });
});
