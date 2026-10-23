import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapStepsToDates, type ProjectPlanFields, type ProjectPlanStepDto } from "./project-plan";

const project: ProjectPlanFields = {
  id: "p1",
  name: "Thesis",
  planActive: true,
  planWorkdays: "[1,2,3,4,5]",
  planAnchorDate: "2026-09-01",
  planSkipDates: "[]",
  planExtraDates: "[]",
  startDate: null,
  category: null,
};

function step(id: string, sortOrder: number, extra: Partial<ProjectPlanStepDto> = {}): ProjectPlanStepDto {
  return {
    id,
    projectId: "p1",
    sortOrder,
    title: id,
    detail: null,
    estMinutes: null,
    milestoneId: null,
    isMilestone: false,
    done: false,
    doneDate: null,
    scheduledDate: null,
    ...extra,
  };
}

const placed = (byDate: Record<string, Array<{ id: string }>>) =>
  Object.fromEntries(Object.entries(byDate).map(([d, list]) => [d, list.map((s) => s.id)]));

describe("mapStepsToDates · 自动顺延", () => {
  it("rolls a backlog forward from today, earliest step first", () => {
    // 2026-10-12 is a Monday
    const { byDate, nextStep } = mapStepsToDates(project, [step("a", 0), step("b", 1)], "2026-10-12");
    assert.deepEqual(placed(byDate), { "2026-10-12": ["a"], "2026-10-13": ["b"] });
    assert.equal(nextStep?.id, "a");
  });

  it("brings steps pinned to a missed past date back into the queue", () => {
    const { byDate } = mapStepsToDates(
      project,
      [step("missed", 0, { scheduledDate: "2026-10-01" }), step("next", 1)],
      "2026-10-12"
    );
    assert.deepEqual(placed(byDate), { "2026-10-12": ["missed"], "2026-10-13": ["next"] });
  });

  it("keeps future pins and done history where they are", () => {
    const { byDate } = mapStepsToDates(
      project,
      [
        step("done", 0, { done: true, doneDate: "2026-10-05" }),
        step("pinned", 1, { scheduledDate: "2026-10-20" }),
        step("open", 2),
      ],
      "2026-10-12"
    );
    assert.deepEqual(placed(byDate), {
      "2026-10-05": ["done"],
      "2026-10-20": ["pinned"],
      "2026-10-12": ["open"],
    });
  });

  it("never puts two steps of one project on the same day", () => {
    const { byDate } = mapStepsToDates(
      project,
      [step("backlog", 0, { scheduledDate: "2026-09-21" }), step("pinnedToday", 1, { scheduledDate: "2026-10-12" })],
      "2026-10-12"
    );
    assert.deepEqual(placed(byDate), { "2026-10-12": ["pinnedToday"], "2026-10-13": ["backlog"] });
  });

  it("skips non-workdays when rolling (Saturday → Monday)", () => {
    const { byDate } = mapStepsToDates(project, [step("a", 0)], "2026-10-10");
    assert.deepEqual(placed(byDate), { "2026-10-12": ["a"] });
  });
});
