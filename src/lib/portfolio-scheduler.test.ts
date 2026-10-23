import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertDailyCap,
  assignmentsByDay,
  schedulePortfolio,
} from "./portfolio-scheduler";

describe("schedulePortfolio", () => {
  it("caps three open steps a day and one per project", () => {
    const result = schedulePortfolio(
      [
        {
          id: "a",
          name: "A",
          pinned: true,
          priority: "HIGH",
          sortOrder: 0,
          steps: [
            { id: "a1", sortOrder: 0, done: false },
            { id: "a2", sortOrder: 1, done: false },
          ],
        },
        {
          id: "b",
          name: "B",
          priority: "HIGH",
          sortOrder: 1,
          steps: [
            { id: "b1", sortOrder: 0, done: false },
            { id: "b2", sortOrder: 1, done: false },
          ],
        },
        {
          id: "c",
          name: "C",
          priority: "MEDIUM",
          sortOrder: 2,
          steps: [{ id: "c1", sortOrder: 0, done: false }],
        },
        {
          id: "d",
          name: "D",
          priority: "LOW",
          sortOrder: 3,
          steps: [{ id: "d1", sortOrder: 0, done: false }],
        },
      ],
      "2026-09-02"
    );

    assert.equal(assertDailyCap(result.assignments, 3), true);
    const day1 = assignmentsByDay(result.assignments).get("2026-09-02") ?? [];
    assert.equal(day1.length, 3);
    assert.deepEqual(
      day1.map((item) => item.projectId),
      ["a", "b", "c"]
    );
    assert.equal(result.assignments.find((item) => item.stepId === "a2")?.date, "2026-09-03");
  });

  it("round-robins so a long project cannot monopolize the calendar", () => {
    const longSteps = Array.from({ length: 6 }, (_, i) => ({
      id: `l${i}`,
      sortOrder: i,
      done: false,
    }));
    const result = schedulePortfolio(
      [
        { id: "long", name: "Learning", priority: "HIGH", sortOrder: 0, steps: longSteps },
        {
          id: "short",
          name: "Thesis",
          pinned: true,
          priority: "HIGH",
          sortOrder: 1,
          deadlineRisk: 10,
          steps: [{ id: "s1", sortOrder: 0, done: false }],
        },
      ],
      "2026-09-02"
    );
    const day1 = assignmentsByDay(result.assignments).get("2026-09-02") ?? [];
    assert.equal(day1.some((item) => item.projectId === "short"), true);
    assert.equal(day1.filter((item) => item.projectId === "long").length, 1);
  });

  it("rotates across more projects than the daily capacity", () => {
    const result = schedulePortfolio(
      ["a", "b", "c", "d", "e"].map((id, index) => ({
        id,
        name: id.toUpperCase(),
        priority: "HIGH",
        sortOrder: index,
        steps: [
          { id: `${id}1`, sortOrder: 0, done: false },
          { id: `${id}2`, sortOrder: 1, done: false },
        ],
      })),
      "2026-09-02"
    );

    assert.deepEqual(
      (assignmentsByDay(result.assignments).get("2026-09-02") ?? []).map(
        (item) => item.projectId
      ),
      ["a", "b", "c"]
    );
    assert.deepEqual(
      (assignmentsByDay(result.assignments).get("2026-09-03") ?? []).map(
        (item) => item.projectId
      ),
      ["d", "e", "a"]
    );
  });

  it("leaves completed steps unscheduled", () => {
    const result = schedulePortfolio(
      [
        {
          id: "p",
          name: "P",
          steps: [
            { id: "done", sortOrder: 0, done: true, scheduledDate: "2026-08-01" },
            { id: "open", sortOrder: 1, done: false },
          ],
        },
      ],
      "2026-09-02"
    );
    assert.deepEqual(result.assignments.map((item) => item.stepId), ["open"]);
    assert.equal(result.assignments[0]?.date, "2026-09-02");
  });
});
