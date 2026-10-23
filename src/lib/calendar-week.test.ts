import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWeekAppointments,
  calendarDateKey,
  clockTimeKey,
  type WeekAppointmentSources,
} from "./calendar-week";

const WEEK = [
  "2026-09-28",
  "2026-09-29",
  "2026-09-30",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
];

function sources(partial: Partial<WeekAppointmentSources> = {}): WeekAppointmentSources {
  return {
    meetings: [],
    tasks: [],
    opportunities: [],
    taskBlocks: [],
    ...partial,
  };
}

describe("clock and date keys", () => {
  it("reads a clock time and ignores a bare date", () => {
    assert.equal(clockTimeKey("16:00"), "16:00");
    assert.equal(clockTimeKey("2026-09-29 15:05"), "15:05");
    assert.equal(clockTimeKey("2026-09-29"), null);
    assert.equal(calendarDateKey("2026-09-29 15:05"), "2026-09-29");
  });
});

describe("buildWeekAppointments", () => {
  it("places timed meetings on the hour grid and dateless-time meetings on the all-day row", () => {
    const days = buildWeekAppointments(
      WEEK,
      sources({
        meetings: [
          {
            id: "m1",
            title: "有时刻",
            meetingDate: "2026-10-02",
            meetingTime: "16:00",
            durationMin: "45",
            purpose: null,
            content: null,
            status: "Scheduled",
          },
          {
            id: "m2",
            title: "只有日期",
            meetingDate: "2026-10-03",
            meetingTime: null,
            durationMin: null,
            purpose: null,
            content: null,
            status: "Scheduled",
          },
          {
            id: "m3",
            title: "取消",
            meetingDate: "2026-10-03",
            meetingTime: "09:00",
            durationMin: "30",
            purpose: null,
            content: null,
            status: "Cancelled",
          },
        ],
      })
    );
    const timed = days.find((d) => d.date === "2026-10-02")?.blocks ?? [];
    assert.equal(timed.length, 1);
    assert.equal(timed[0]?.kind, "meeting");
    assert.equal(timed[0]?.allDay, false);
    assert.equal(timed[0]?.startTime, "16:00");
    assert.equal(timed[0]?.endTime, "16:45");

    const allDay = days.find((d) => d.date === "2026-10-03")?.blocks ?? [];
    assert.equal(allDay.length, 1);
    assert.equal(allDay[0]?.allDay, true);
    assert.equal(allDay[0]?.title, "只有日期");
  });

  it("shows opportunities and tasks that fall in the week, and drops ones without a date", () => {
    const days = buildWeekAppointments(
      WEEK,
      sources({
        opportunities: [
          {
            id: "o1",
            title: "本周截止",
            deadline: "2026-09-29",
            status: "Active",
            nextAction: "交材料",
          },
          {
            id: "o2",
            title: "没有日期",
            deadline: null,
            status: "Active",
            nextAction: null,
          },
          {
            id: "o3",
            title: "已放弃",
            deadline: "2026-09-30",
            status: "Passed",
            nextAction: null,
          },
          {
            id: "o4",
            title: "带时刻",
            deadline: "2026-10-01 14:00",
            status: "Watching",
            nextAction: null,
          },
        ],
        tasks: [
          {
            id: "t1",
            title: "计划日",
            scheduledDate: "2026-10-04",
            dueDate: "2026-10-20",
            completed: false,
            cancelled: false,
          },
          {
            id: "t2",
            title: "已取消",
            scheduledDate: "2026-10-04",
            dueDate: null,
            completed: false,
            cancelled: true,
          },
        ],
      })
    );

    const titles = days.flatMap((d) => d.blocks.map((b) => b.title));
    assert.deepEqual(titles.sort(), ["带时刻", "本周截止", "计划日"]);

    const deadline = days.find((d) => d.date === "2026-09-29")?.blocks[0];
    assert.equal(deadline?.kind, "opportunity");
    assert.equal(deadline?.allDay, true);
    assert.equal(deadline?.description, "交材料");

    const timedOpp = days.find((d) => d.date === "2026-10-01")?.blocks[0];
    assert.equal(timedOpp?.allDay, false);
    assert.equal(timedOpp?.startTime, "14:00");
    assert.equal(timedOpp?.endTime, "15:00");

    const task = days.find((d) => d.date === "2026-10-04")?.blocks[0];
    assert.equal(task?.kind, "task");
    assert.equal(task?.allDay, true);
  });

  it("uses a placed task block instead of a second all-day chip", () => {
    const days = buildWeekAppointments(
      WEEK,
      sources({
        tasks: [
          {
            id: "t1",
            title: "原任务",
            scheduledDate: "2026-10-02",
            dueDate: null,
            completed: false,
            cancelled: false,
          },
        ],
        taskBlocks: [
          {
            id: "b1",
            date: "2026-10-02",
            title: "原任务",
            description: null,
            startTime: "11:00",
            endTime: "11:30",
            color: "#6366f1",
            taskId: "t1",
            skipped: false,
          },
        ],
      })
    );
    const blocks = days.find((d) => d.date === "2026-10-02")?.blocks ?? [];
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.allDay, false);
    assert.equal(blocks[0]?.startTime, "11:00");
    assert.equal(blocks[0]?.endTime, "11:30");
  });
});
