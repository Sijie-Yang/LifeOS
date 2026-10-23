import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  barOverlapsWindow,
  clipBar,
  clusterPointsForScale,
  clusterSameDayPoints,
  collectTimelinePayload,
  dateInWindow,
  dedupeBySourceId,
  buildColumns,
  defaultWindow,
  mergeRowOrder,
  moveRow,
  normalizeDateKey,
  parseRowOrder,
  parseScale,
  ROW_ORDER_SOURCE,
  parseView,
  rangeToPercent,
  shiftWindow,
  showsStepPoints,
  timelineQuery,
  type ProjectTimelineInput,
  type TimelineItem,
} from "./timeline";

describe("normalizeDateKey", () => {
  it("keeps YYYY-MM-DD", () => {
    assert.equal(normalizeDateKey("2026-09-02"), "2026-09-02");
  });

  it("expands YYYY-MM to month bounds", () => {
    assert.equal(normalizeDateKey("2026-06", "start"), "2026-06-01");
    assert.equal(normalizeDateKey("2026-06", "end"), "2026-06-30");
  });

  it("expands years and year ranges", () => {
    assert.equal(normalizeDateKey("2026", "start"), "2026-01-01");
    assert.equal(normalizeDateKey("2026", "end"), "2026-12-31");
    assert.equal(normalizeDateKey("2029–2030", "start"), "2029-01-01");
    assert.equal(normalizeDateKey("2029-2030", "end"), "2030-12-31");
    assert.equal(normalizeDateKey(2027, "end"), "2027-12-31");
  });

  it("formats DateTime values", () => {
    assert.equal(normalizeDateKey(new Date("2026-03-15T00:00:00"), "start"), "2026-03-15");
  });

  it("returns null for empty values", () => {
    assert.equal(normalizeDateKey(null), null);
    assert.equal(normalizeDateKey(""), null);
    assert.equal(normalizeDateKey("not-a-date"), null);
  });
});

describe("window clipping", () => {
  it("detects dates inside the window", () => {
    assert.equal(dateInWindow("2026-06-15", "2026-01-01", "2026-12-31"), true);
    assert.equal(dateInWindow("2025-12-31", "2026-01-01", "2026-12-31"), false);
  });

  it("clips overlapping bars and drops outsiders", () => {
    assert.deepEqual(clipBar("2025-06-01", "2026-06-01", "2026-01-01", "2026-12-31"), {
      start: "2026-01-01",
      end: "2026-06-01",
    });
    assert.equal(clipBar("2024-01-01", "2024-12-31", "2026-01-01", "2026-12-31"), null);
    assert.equal(barOverlapsWindow("2025-01-01", "2027-01-01", "2026-01-01", "2026-12-31"), true);
  });

  it("computes percent ranges for a clipped bar", () => {
    const pct = rangeToPercent("2026-01-01", "2026-12-31", "2026-01-01", "2026-12-31");
    assert.ok(pct);
    assert.equal(pct.left, 0);
    assert.ok(pct.width > 99);
  });
});

describe("scale windows", () => {
  it("parses scale with month fallback and maps legacy week", () => {
    assert.equal(parseScale("year"), "year");
    assert.equal(parseScale("decade"), "decade");
    assert.equal(parseScale("week"), "month");
    assert.equal(parseScale("nope"), "month");
    assert.equal(parseView("week"), "day");
    assert.equal(parseView("day"), "day");
    assert.equal(parseView("powers"), "powers");
    assert.equal(parseView("nope"), "month");
  });

  it("builds month / year / decade natural windows around today", () => {
    const month = defaultWindow("month", "2026-09-02");
    assert.equal(month.start, "2026-09-01");
    assert.equal(month.end, "2026-09-30");

    const year = defaultWindow("year", "2026-09-02");
    assert.equal(year.start, "2026-01-01");
    assert.equal(year.end, "2026-12-31");

    const decade = defaultWindow("decade", "2026-09-02");
    assert.equal(decade.start, "2026-01-01");
    assert.equal(decade.end, "2035-12-31");
  });

  it("shifts windows by one month, one year, or ten years", () => {
    const nextMonth = shiftWindow("month", "2026-09-01", "2026-09-30", 1);
    assert.equal(nextMonth.start, "2026-10-01");
    assert.equal(nextMonth.end, "2026-10-31");

    const nextYear = shiftWindow("year", "2026-01-01", "2026-12-31", 1);
    assert.equal(nextYear.start, "2027-01-01");
    assert.equal(nextYear.end, "2027-12-31");

    const nextDecade = shiftWindow("decade", "2026-01-01", "2035-12-31", 1);
    assert.equal(nextDecade.start, "2036-01-01");
    assert.equal(nextDecade.end, "2045-12-31");
  });

  it("builds day / month / year columns for the three scales", () => {
    const monthCols = buildColumns("month", "2026-09-01", "2026-09-30");
    assert.equal(monthCols.length, 30);
    assert.equal(monthCols[0]?.key, "2026-09-01");
    assert.equal(monthCols[29]?.key, "2026-09-30");

    const yearCols = buildColumns("year", "2026-01-01", "2026-12-31");
    assert.equal(yearCols.length, 12);
    assert.equal(yearCols[0]?.key, "2026-01");
    assert.equal(yearCols[11]?.key, "2026-12");

    const decadeCols = buildColumns("decade", "2026-01-01", "2035-12-31");
    assert.equal(decadeCols.length, 10);
    assert.equal(decadeCols[0]?.key, "2026");
    assert.equal(decadeCols[9]?.key, "2035");
  });
});

describe("dedupe and clustering", () => {
  it("keeps the first item per source id", () => {
    const out = dedupeBySourceId([
      { sourceId: "m1", title: "db" },
      { sourceId: "s1", title: "step" },
      { sourceId: "s1", title: "derived" },
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[1]?.title, "step");
  });

  it("clusters points that share a day", () => {
    const clusters = clusterSameDayPoints([
      point("a", "2026-09-02"),
      point("b", "2026-09-02"),
      point("c", "2026-09-03"),
    ]);
    assert.equal(clusters.length, 2);
    assert.equal(clusters[0]?.items.length, 2);
    assert.equal(clusters[1]?.items.length, 1);
  });

  it("clusters year points by month and decade points by year", () => {
    const year = clusterPointsForScale(
      [point("a", "2026-09-02"), point("b", "2026-09-18"), point("c", "2026-10-01")],
      "year"
    );
    assert.equal(year.length, 2);
    assert.equal(year[0]?.items.length, 2);
    assert.equal(year[1]?.items.length, 1);

    const decade = clusterPointsForScale(
      [point("a", "2026-09-02"), point("b", "2027-01-01")],
      "decade"
    );
    assert.equal(decade.length, 2);
  });

  it("builds cache keys with scale and window", () => {
    assert.equal(
      timelineQuery("month", "2026-09-01", "2026-09-30"),
      "scale=month&start=2026-09-01&end=2026-09-30"
    );
  });
});

describe("timeline row order", () => {
  it("parses stored layer orders and ignores other overrides", () => {
    const order = parseRowOrder([
      { source: ROW_ORDER_SOURCE, sourceId: "goal", detail: '["goal:b","goal:a"]' },
      { source: ROW_ORDER_SOURCE, sourceId: "project", detail: '["project:x"]' },
      { source: ROW_ORDER_SOURCE, sourceId: "event", detail: "not json" },
      { source: "foresight-era", sourceId: "e1", detail: "x" },
    ]);
    assert.deepEqual(order, { goal: ["goal:b", "goal:a"] });
  });

  it("puts the new visible order first and keeps off-window rows", () => {
    assert.deepEqual(mergeRowOrder(["a", "b", "c", "d"], ["c", "a"]), ["c", "a", "b", "d"]);
  });

  it("moves a row onto its target position", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(moveRow(rows, "a", "c").map((r) => r.id), ["b", "c", "a"]);
    assert.deepEqual(moveRow(rows, "c", "a").map((r) => r.id), ["c", "a", "b"]);
    assert.equal(moveRow(rows, "a", "missing"), rows);
  });

  it("sorts goal rows by manual order, then by title", () => {
    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "year",
      start: "2026-01-01",
      end: "2026-12-31",
      projects: [project({ id: "p1", name: "P", pinned: true })],
      goals: ["甲", "乙", "丙"].map((title, i) => ({
        id: `g${i}`,
        title,
        area: "career",
        status: "ACTIVE",
        targetDate: new Date("2026-10-01"),
      })),
      phases: [],
      opportunities: [],
      rowOrder: { goal: ["goal:g2", "goal:g0"] },
    });
    const goalRows = payload.rows.filter((r) => r.layer === "goal").map((r) => r.id);
    assert.deepEqual(goalRows, ["goal:g2", "goal:g0", "goal:g1"]);
    assert.equal(payload.rows.find((r) => r.id === "project:p1")?.pinned, true);
  });
});

describe("collectTimelinePayload", () => {
  it("draws a project bar only with real start and end", () => {
    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "month",
      start: "2026-01-01",
      end: "2026-12-31",
      projects: [
        project({
          id: "p1",
          name: "Has range",
          startDate: new Date("2026-03-01"),
          targetDate: new Date("2026-08-01"),
        }),
        project({
          id: "p2",
          name: "Deadline only",
          targetDate: new Date("2026-10-01"),
        }),
        project({ id: "p3", name: "No dates" }),
      ],
      goals: [],
      phases: [],
      opportunities: [],
    });

    const bars = payload.items.filter((i) => i.source === "project" && i.kind === "bar");
    const points = payload.items.filter((i) => i.source === "project" && i.kind === "point");
    assert.equal(bars.length, 1);
    assert.equal(bars[0]?.id, "project-bar:p1");
    assert.equal(points.length, 1);
    assert.equal(points[0]?.id, "project-point:p2");
    assert.equal(payload.undatedProjectCount, 1);
  });

  it("maps plan steps as computed points and dedupes milestones by source id", () => {
    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "month",
      start: "2026-09-01",
      end: "2026-09-30",
      projects: [
        project({
          id: "p1",
          name: "Plan",
          startDate: new Date("2026-09-01"),
          targetDate: new Date("2026-09-30"),
          planActive: true,
          planAnchorDate: "2026-09-01",
          planSteps: [
            {
              id: "s1",
              projectId: "p1",
              sortOrder: 0,
              title: "Done step",
              detail: null,
              estMinutes: null,
              milestoneId: null,
              isMilestone: true,
              done: true,
              doneDate: "2026-09-01",
            },
            {
              id: "s2",
              projectId: "p1",
              sortOrder: 1,
              title: "Open step",
              detail: null,
              estMinutes: null,
              milestoneId: null,
              isMilestone: false,
              done: false,
              doneDate: null,
            },
          ],
          milestones: [
            {
              id: "s1",
              title: "Same source as done step",
              dueDate: new Date("2026-09-01"),
              completed: true,
              sortOrder: 0,
            },
          ],
        }),
      ],
      goals: [],
      phases: [],
      opportunities: [],
    });

    const steps = payload.items.filter((i) => i.source === "plan-step");
    const milestones = payload.items.filter((i) => i.source === "milestone");
    assert.equal(steps.length, 1);
    assert.equal(steps[0]?.title, "Open step");
    assert.equal(steps[0]?.computed, true);
    assert.equal(milestones.length, 1);
    assert.equal(milestones[0]?.sourceId, "s1");
    assert.equal(milestones[0]?.computed, undefined);
  });

  it("hides plan steps on the decade scale but keeps milestones", () => {
    assert.equal(showsStepPoints("decade"), false);
    assert.equal(showsStepPoints("month"), true);
    assert.equal(showsStepPoints("year"), true);

    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "decade",
      start: "2026-01-01",
      end: "2035-12-31",
      projects: [
        project({
          id: "p1",
          name: "Plan",
          startDate: new Date("2026-09-01"),
          targetDate: new Date("2026-09-30"),
          planActive: true,
          planAnchorDate: "2026-09-01",
          planSteps: [
            {
              id: "s2",
              projectId: "p1",
              sortOrder: 1,
              title: "Open step",
              detail: null,
              estMinutes: null,
              milestoneId: null,
              isMilestone: false,
              done: false,
              doneDate: null,
            },
          ],
          milestones: [
            {
              id: "m1",
              title: "Ship",
              dueDate: new Date("2026-09-15"),
              completed: false,
              sortOrder: 0,
            },
          ],
        }),
      ],
      goals: [],
      phases: [],
      opportunities: [],
    });

    assert.equal(payload.items.filter((i) => i.source === "plan-step").length, 0);
    assert.equal(payload.items.filter((i) => i.source === "milestone").length, 1);
    assert.ok(payload.items.some((i) => i.id === "project-bar:p1"));
  });

  it("keeps a multi-year project bar visible on the year scale", () => {
    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "year",
      start: "2024-01-01",
      end: "2033-12-31",
      projects: [
        project({
          id: "p-span",
          name: "跨年项目",
          startDate: new Date("2025-11-01"),
          targetDate: new Date("2027-02-15"),
        }),
      ],
      goals: [],
      phases: [],
      opportunities: [],
    });
    const bar = payload.items.find((i) => i.id === "project-bar:p-span");
    assert.ok(bar);
    assert.equal(bar?.start, "2025-11-01");
    assert.equal(bar?.end, "2027-02-15");
  });

  it("skips closed opportunities and keeps Won as a done point", () => {
    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "month",
      start: "2026-01-01",
      end: "2026-12-31",
      projects: [],
      goals: [],
      phases: [],
      opportunities: [
        {
          id: "o1",
          title: "Lost",
          status: "Lost",
          deadline: "2026-09-10",
          nextAction: null,
          projectId: null,
          goalId: null,
        },
        {
          id: "o2",
          title: "Won intern",
          status: "Won",
          deadline: "2026-09-10",
          nextAction: "send thanks",
          projectId: null,
          goalId: null,
        },
      ],
    });
    const opps = payload.items.filter((i) => i.source === "opportunity");
    assert.equal(opps.length, 1);
    assert.equal(opps[0]?.status, "done");
    assert.equal(opps[0]?.rowId, "opportunity:o2");
    assert.equal(opps[0]?.layer, "event");
  });

  it("gives every project a row and labels undated ones", () => {
    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "month",
      start: "2026-09-01",
      end: "2026-09-30",
      projects: [
        project({ id: "dated", name: "Dated", startDate: new Date("2026-09-01"), targetDate: new Date("2026-09-20") }),
        project({ id: "bare", name: "Bare" }),
      ],
      goals: [],
      phases: [],
      opportunities: [],
    });
    assert.ok(payload.rows.some((row) => row.id === "project:dated"));
    const bare = payload.rows.find((row) => row.id === "project:bare");
    assert.ok(bare);
    assert.equal(bare?.subtitle, "未排期");
    assert.equal(payload.undatedProjectCount, 1);
  });

  it("puts each opportunity and meeting on its own row", () => {
    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "month",
      start: "2026-09-01",
      end: "2026-09-30",
      projects: [
        project({
          id: "p1",
          name: "Host",
          startDate: new Date("2026-09-01"),
          targetDate: new Date("2026-09-30"),
        }),
      ],
      goals: [],
      phases: [],
      opportunities: [
        {
          id: "o1",
          title: "Grant",
          status: "Active",
          deadline: "2026-09-12",
          nextAction: "write",
          projectId: "p1",
          goalId: null,
        },
        {
          id: "o2",
          title: "No date",
          status: "Watching",
          deadline: null,
          nextAction: null,
          projectId: null,
          goalId: null,
        },
      ],
      meetings: [
        {
          id: "m1",
          title: "Coffee",
          status: "Scheduled",
          meetingDate: "2026-09-08",
          meetingTime: "10:00",
          projectId: "p1",
        },
        {
          id: "m2",
          title: "Past talk",
          status: "NeedsReview",
          meetingDate: "2026-08-20",
          meetingTime: "14:00",
          projectId: null,
        },
      ],
    });
    assert.ok(payload.items.some((item) => item.id === "opportunity:o1" && item.rowId === "opportunity:o1"));
    assert.equal(payload.items.filter((item) => item.rowId === "project:p1" && item.source === "opportunity").length, 0);
    assert.ok(payload.rows.some((row) => row.id === "meeting:m1"));
    assert.ok(payload.pendingReview.some((item) => item.id === "opportunity:o2" && item.kind === "opportunity"));
    assert.ok(payload.pendingReview.some((item) => item.id === "meeting:m2" && item.kind === "meeting"));
  });

  it("keeps completed opportunities and meetings out of pending review", () => {
    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "month",
      start: "2026-09-01",
      end: "2026-09-30",
      projects: [],
      goals: [],
      phases: [],
      opportunities: [
        {
          id: "o-won",
          title: "Won undated",
          status: "Won",
          deadline: null,
          nextAction: null,
          projectId: null,
          goalId: null,
        },
      ],
      meetings: [
        {
          id: "m-done",
          title: "Done talk",
          status: "Completed",
          meetingDate: "2026-08-20",
          meetingTime: "14:00",
          projectId: null,
        },
      ],
    });
    assert.equal(payload.pendingReview.length, 0);
  });
});

function point(id: string, start: string): TimelineItem {
  return {
    id,
    kind: "point",
    layer: "project",
    source: "plan-step",
    sourceId: id,
    title: id,
    href: "/projects",
    start,
    rowId: "project:p",
    rowTitle: "P",
    color: "#6366f1",
    status: "upcoming",
  };
}

function project(partial: Partial<ProjectTimelineInput> & { id: string; name: string }): ProjectTimelineInput {
  return {
    planActive: false,
    planWorkdays: "[1,2,3,4,5]",
    planAnchorDate: null,
    planSkipDates: "[]",
    planExtraDates: "[]",
    startDate: null,
    category: { color: "#6366f1" },
    status: "ACTIVE",
    progress: 0,
    archiveDate: null,
    targetDate: null,
    completedAt: null,
    planSteps: [],
    milestones: [],
    sortOrder: 0,
    ...partial,
  };
}

describe("project row order", () => {
  it("follows sortOrder instead of name", () => {
    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "year",
      start: "2026-01-01",
      end: "2026-12-31",
      projects: [
        project({
          id: "later",
          name: "Zed",
          sortOrder: 2,
          startDate: new Date("2026-01-01"),
          targetDate: new Date("2026-12-01"),
        }),
        project({
          id: "first",
          name: "Aaa",
          sortOrder: 0,
          startDate: new Date("2026-01-01"),
          targetDate: new Date("2026-12-01"),
        }),
        project({
          id: "mid",
          name: "Mmm",
          sortOrder: 1,
          startDate: new Date("2026-01-01"),
          targetDate: new Date("2026-12-01"),
        }),
      ],
      goals: [],
      phases: [],
      opportunities: [],
    });
    const projectRows = payload.rows.filter((row) => row.layer === "project");
    assert.deepEqual(
      projectRows.map((row) => row.id),
      ["project:first", "project:mid", "project:later"]
    );
  });

  it("keeps pinned projects first and ordered among themselves", () => {
    const payload = collectTimelinePayload({
      today: "2026-09-02",
      scale: "year",
      start: "2026-01-01",
      end: "2026-12-31",
      projects: [
        project({
          id: "loose",
          name: "Loose",
          pinned: false,
          sortOrder: 0,
          startDate: new Date("2026-01-01"),
          targetDate: new Date("2026-12-01"),
        }),
        project({
          id: "pin-b",
          name: "Pin B",
          pinned: true,
          sortOrder: 8,
          startDate: new Date("2026-01-01"),
          targetDate: new Date("2026-12-01"),
        }),
        project({
          id: "pin-a",
          name: "Pin A",
          pinned: true,
          sortOrder: 3,
          startDate: new Date("2026-01-01"),
          targetDate: new Date("2026-12-01"),
        }),
      ],
      goals: [],
      phases: [],
      opportunities: [],
    });
    const projectRows = payload.rows.filter((row) => row.layer === "project");
    assert.deepEqual(
      projectRows.map((row) => row.id),
      ["project:pin-a", "project:pin-b", "project:loose"]
    );
  });
});
