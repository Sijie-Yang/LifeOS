import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { projectHealth, sortByHealth, type ProjectHealthInput } from "./project-health";

const base: ProjectHealthInput = {
  id: "p", name: "P", power: null, planActive: true, done: 2, total: 10,
  lastDoneDate: "2026-10-09", nextStepDate: "2026-10-12", nextStepTitle: "x", scheduledToday: false,
  targetDate: null, projectedFinish: "2026-10-30", nextMilestone: null,
};
const T = "2026-10-11";

describe("project health", () => {
  it("is green when moving and on time", () => {
    assert.equal(projectHealth(base, T).level, "green");
  });
  it("is red when projected past the target or stalled for 2 weeks", () => {
    const late = projectHealth({ ...base, targetDate: "2026-10-25" }, T);
    assert.equal(late.level, "red");
    assert.equal(late.slipDays, 5);
    assert.equal(projectHealth({ ...base, lastDoneDate: "2026-09-20" }, T).level, "red");
    assert.equal(projectHealth({ ...base, nextMilestone: { title: "m", date: "2026-10-01" } }, T).level, "red");
  });
  it("is amber for a week without progress, a near target or no next step", () => {
    assert.equal(projectHealth({ ...base, lastDoneDate: "2026-10-02" }, T).level, "amber");
    assert.equal(projectHealth({ ...base, lastDoneDate: null }, T).reasons[0], "还没推进过");
    assert.equal(projectHealth({ ...base, targetDate: "2026-10-20", projectedFinish: "2026-10-18" }, T).level, "amber");
    assert.equal(projectHealth({ ...base, done: 10, total: 10 }, T).level, "amber");
    // 暂停的项目不算「没推进」
    assert.equal(projectHealth({ ...base, planActive: false, lastDoneDate: "2026-08-01" }, T).level, "green");
  });
  it("does not flag a project that was just re-planned", () => {
    const fresh = projectHealth({ ...base, lastDoneDate: "2026-07-01", lastActivityDate: "2026-10-11" }, T);
    assert.equal(fresh.level, "green");
    assert.equal(fresh.daysSinceProgress, 0);
  });
  it("sorts red first, then by nearest deadline", () => {
    const list = sortByHealth([
      projectHealth({ ...base, id: "g", name: "G" }, T),
      projectHealth({ ...base, id: "a", name: "A", lastDoneDate: "2026-10-02", targetDate: "2026-12-01", projectedFinish: "2026-11-01" }, T),
      projectHealth({ ...base, id: "r", name: "R", targetDate: "2026-10-20" }, T),
    ]);
    assert.deepEqual(list.map((p) => p.id), ["r", "a", "g"]);
  });
});
