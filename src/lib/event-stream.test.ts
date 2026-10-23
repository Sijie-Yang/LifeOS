import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEventStream,
  filterStream,
  groupStreamByDay,
  nowIndex,
  streamFacets,
  type StreamSources,
} from "./event-stream";

const alice = { id: "c1", name: "Alice", importance: 5 };
const bob = { id: "c2", name: "Bob", importance: 3 };
const research = { id: "p1", name: "Research" };

function sources(overrides: Partial<StreamSources> = {}): StreamSources {
  return {
    start: "2026-09-26",
    end: "2026-09-30",
    today: "2026-09-28",
    habits: [],
    habitCheckIns: [],
    blocks: [],
    tasks: [],
    meetings: [],
    contactLogs: [],
    runs: [],
    steps: [],
    focus: [],
    ...overrides,
  };
}

describe("event stream", () => {
  it("keeps habits out of the stream (they are checked in on the daily page)", () => {
    const events = buildEventStream(
      sources({
        habits: [
          {
            id: "h1", name: "运动", description: "热身 → 主练", startTime: "7:30", endTime: "09:30",
            daysOfWeek: "[0,1,2,3,4,5,6]", scheduleMode: "none", project: null,
          },
        ],
        habitCheckIns: [{ habitId: "h1", date: "2026-09-28", completed: true }],
      })
    );
    assert.equal(events.some((e) => e.title === "运动" || e.kind === "routine"), false);
  });

  it("rolls overdue tasks and plan steps onto today", () => {
    const events = buildEventStream(
      sources({
        tasks: [
          {
            id: "t1", title: "回邮件", completed: false, completedAt: null, dueDate: "2026-09-20",
            scheduledDate: null, project: null, contact: alice,
          },
        ],
        steps: [
          {
            id: "s1", title: "写方法", detail: null, done: false, doneDate: null,
            scheduledDate: "2026-09-27", feedback: null, project: research,
          },
          {
            id: "s3", title: "画图", detail: null, done: false, doneDate: null,
            scheduledDate: "2026-09-27", feedback: null, project: research,
          },
          {
            id: "s2", title: "跑实验", detail: null, done: true, doneDate: "2026-09-26",
            scheduledDate: "2026-09-26", feedback: "收敛了", project: research,
          },
        ],
      })
    );
    const byId = new Map(events.map((e) => [e.id, e]));
    assert.equal(byId.get("task:t1")?.date, "2026-09-28");
    assert.equal(byId.get("task:t1")?.overdueFrom, "2026-09-20");
    assert.equal(byId.get("step:s1")?.overdueFrom, "2026-09-27");
    assert.equal(byId.get("step:s1")?.note, "后面还有 1 步逾期");
    assert.ok(!byId.has("step:s3"));
    assert.equal(byId.get("step:s2")?.note, "收敛了");
  });

  it("links active SOP runs to events sharing a project or person", () => {
    const events = buildEventStream(
      sources({
        runs: [
          {
            id: "r1", title: "投稿清单", status: "active",
            items: JSON.stringify([{ id: "a", text: "查格式", done: true }, { id: "b", text: "cover", done: false }]),
            createdAt: new Date(2026, 8, 20), completedAt: null,
            template: { id: "tpl1", title: "论文投稿" }, project: research, contact: null,
          },
        ],
        steps: [
          {
            id: "s1", title: "写方法", detail: null, done: false, doneDate: null,
            scheduledDate: "2026-09-29", feedback: null, project: research,
          },
        ],
      })
    );
    const step = events.find((e) => e.id === "step:s1");
    assert.equal(step?.sop?.key, "tpl:tpl1");
    assert.equal(step?.sop?.progress?.done, 1);
    assert.equal(step?.sop?.progress?.total, 2);
    assert.ok(events.some((e) => e.id === "sop:r1" && e.date === "2026-09-28"));
  });

  it("folds low-signal contacts unless asked, and filters by person", () => {
    const events = buildEventStream(
      sources({
        contactLogs: [
          { id: "l1", type: "wechat", content: null, contactedAt: new Date(2026, 8, 27, 10, 0), contact: bob, contactHasProject: false },
          { id: "l2", type: "meeting", content: "聊合作", contactedAt: new Date(2026, 8, 27, 0, 0), contact: alice, contactHasProject: false },
        ],
        meetings: [
          {
            id: "m1", title: "组会", meetingDate: "2026-09-29", meetingTime: "11:00", status: "Scheduled",
            purpose: null, project: research, people: [alice, bob],
          },
        ],
      })
    );
    assert.equal(events.find((e) => e.id === "contact:l1")?.lowSignal, true);
    assert.equal(events.find((e) => e.id === "contact:l2")?.time, null);
    assert.equal(filterStream(events, {}).length, 2);
    assert.equal(filterStream(events, { showLowSignal: true }).length, 3);
    assert.deepEqual(
      filterStream(events, { personId: "c1" }).map((e) => e.id),
      ["contact:l2", "meeting:m1"]
    );
    const facets = streamFacets(events);
    assert.equal(facets.people[0].person.id, "c1");
    assert.equal(facets.lowSignal, 1);
  });

  it("groups by day in order and finds the now marker", () => {
    const events = buildEventStream(
      sources({
        tasks: [
          { id: "t1", title: "A", completed: false, completedAt: null, dueDate: null, scheduledDate: "2026-09-30", project: null, contact: null },
        ],
        meetings: [
          { id: "m1", title: "晨会", meetingDate: "2026-09-28", meetingTime: "09:00", status: "Scheduled", purpose: null, project: research, people: [] },
          { id: "m2", title: "午会", meetingDate: "2026-09-28", meetingTime: "13:00", status: "Scheduled", purpose: null, project: research, people: [] },
        ],
      })
    );
    const days = groupStreamByDay(events);
    assert.deepEqual(days.map((d) => d.date), ["2026-09-28", "2026-09-30"]);
    assert.equal(nowIndex(days[0].events, "10:00"), 1);
  });
});
