import { format } from "date-fns";
import { parseChecklistRunItems, runProgress } from "@/lib/checklists";
import type { HabitScheduleFields } from "@/lib/reminders";
import { ROOM_METHOD } from "@/lib/room-plan";

export type StreamKind = "routine" | "block" | "task" | "meeting" | "contact" | "sop" | "step" | "focus" | "deadline" | "moment";
export type StreamStatus = "done" | "open" | "skipped";

export type StreamPerson = { id: string; name: string; importance: number };
export type StreamRef = { id: string; name: string };

export type StreamSop = {
  key: string;
  title: string;
  href: string;
  text?: string | null;
  progress?: { done: number; total: number } | null;
  /** 清单实例：可以直接在事件流里打勾（PATCH /api/checklists/{runId}） */
  runId?: string;
  /** 房间分区任务：勾选走 POST /api/daily-log { date, roomTask } */
  roomDate?: string;
  items?: Array<{ id: string; text: string; group?: string; done: boolean }>;
};

export type StreamAction =
  | { type: "task"; id: string }
  | { type: "step"; id: string }
  | { type: "habit"; id: string; date: string };

export type StreamEvent = {
  id: string;
  kind: StreamKind;
  title: string;
  date: string;
  time: string | null;
  endTime: string | null;
  status: StreamStatus;
  overdueFrom: string | null;
  people: StreamPerson[];
  sop: StreamSop | null;
  project: StreamRef | null;
  href: string;
  note: string | null;
  lowSignal: boolean;
  action: StreamAction | null;
};

export type StreamHabit = HabitScheduleFields & {
  id: string;
  name: string;
  description: string | null;
  startTime: string | null;
  endTime: string | null;
  project: StreamRef | null;
};

export type StreamSources = {
  start: string;
  end: string;
  today: string;
  habits: StreamHabit[];
  habitCheckIns: Array<{ habitId: string; date: string; completed: boolean }>;
  blocks: Array<{
    id: string;
    date: string;
    title: string;
    description: string | null;
    startTime: string;
    endTime: string;
    skipped: boolean;
    habitId: string | null;
    task: { id: string; completed: boolean; contact: StreamPerson | null; project: StreamRef | null } | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    completed: boolean;
    completedAt: Date | null;
    dueDate: string | null;
    scheduledDate: string | null;
    project: StreamRef | null;
    contact: StreamPerson | null;
  }>;
  meetings: Array<{
    id: string;
    title: string;
    meetingDate: string;
    meetingTime: string | null;
    status: string;
    purpose: string | null;
    project: StreamRef | null;
    people: StreamPerson[];
  }>;
  contactLogs: Array<{
    id: string;
    type: string;
    content: string | null;
    contactedAt: Date;
    contact: StreamPerson;
    contactHasProject: boolean;
  }>;
  /** 临时事件：自由计时 / 补记（「21:27 洗完澡」）；date / time 是本地时间 */
  moments?: Array<{ id: string; title: string; date: string; time: string; endTime: string | null; minutes: number | null; running: boolean; projectName: string | null }>;
  /** 今天的房间分区任务（只含必做 / 顺手；保持的不列） */
  room?: { date: string; tasks: Array<{ key: string; zone: string; text: string; minutes: number }>; done: string[] } | null;
  runs: Array<{
    id: string;
    title: string;
    status: string;
    items: string;
    createdAt: Date;
    completedAt: Date | null;
    template: { id: string; title: string };
    project: StreamRef | null;
    contact: StreamPerson | null;
  }>;
  steps: Array<{
    id: string;
    title: string;
    detail: string | null;
    done: boolean;
    doneDate: string | null;
    scheduledDate: string | null;
    feedback: string | null;
    project: StreamRef;
  }>;
  focus: Array<{ habitId: string; habitName: string; date: string; sessions: number; minutes: number }>;
  /** 机会的 DDL（进行中 / 观察中）；过期没处理的挪到今天 */
  deadlines?: Array<{ id: string; title: string; deadline: string; status: string; nextAction: string | null; project: StreamRef | null }>;
};

/** Importance at or below this (3 is the unrated default), with no project tie, counts as low-signal social. */
export const LOW_SIGNAL_IMPORTANCE = 3;

const KIND_ORDER: Record<StreamKind, number> = {
  deadline: -1,
  meeting: 0,
  block: 1,
  routine: 2,
  task: 3,
  step: 4,
  sop: 5,
  contact: 6,
  focus: 7,
  moment: 8,
};

const CONTACT_LOG_LABEL: Record<string, string> = {
  meet: "见面",
  meeting: "见面",
  call: "通话",
  email: "邮件",
  wechat: "消息",
  message: "消息",
  note: "记录",
};

const TIME_RE = /^\d{1,2}:\d{2}$/;

function cleanTime(value: string | null | undefined): string | null {
  const v = value?.trim() ?? "";
  if (!TIME_RE.test(v)) return null;
  return v.length === 4 ? `0${v}` : v;
}

function dayOf(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function inWindow(date: string | null | undefined, start: string, end: string): date is string {
  return Boolean(date) && date! >= start && date! <= end;
}

function habitSop(habit: StreamHabit | undefined): StreamSop | null {
  const text = habit?.description?.trim();
  if (!habit || !text) return null;
  return { key: `habit:${habit.id}`, title: `${habit.name} · SOP`, href: "/habits", text };
}

function runSop(run: StreamSources["runs"][number]): StreamSop {
  const items = parseChecklistRunItems(run.items);
  return {
    key: `tpl:${run.template.id}`,
    title: run.template.title,
    href: "/checklists",
    progress: runProgress(items),
    runId: run.id,
    items: items.map((it) => ({ id: it.id, text: it.text, group: it.group, done: Boolean(it.done) })),
  };
}

function isLowSignal(people: StreamPerson[], project: StreamRef | null, linked = false) {
  if (project || linked || people.length === 0) return false;
  return people.every((p) => p.importance <= LOW_SIGNAL_IMPORTANCE);
}

function base(partial: Pick<StreamEvent, "id" | "kind" | "title" | "date" | "href"> & Partial<StreamEvent>): StreamEvent {
  return {
    time: null,
    endTime: null,
    status: "open",
    overdueFrom: null,
    people: [],
    sop: null,
    project: null,
    note: null,
    lowSignal: false,
    action: null,
    ...partial,
  };
}

export function buildEventStream(src: StreamSources): StreamEvent[] {
  const { start, end, today } = src;
  const events: StreamEvent[] = [];
  const habitById = new Map(src.habits.map((h) => [h.id, h]));
  const checked = new Set(src.habitCheckIns.filter((c) => c.completed).map((c) => `${c.habitId}:${c.date}`));

  const activeRuns = src.runs.filter((r) => r.status === "active");
  const sopFor = (project: StreamRef | null, people: StreamPerson[]): StreamSop | null => {
    const run = activeRuns.find(
      (r) =>
        (project && r.project?.id === project.id) ||
        (r.contact && people.some((p) => p.id === r.contact!.id))
    );
    return run ? runSop(run) : null;
  };

  for (const b of src.blocks) {
    if (!inWindow(b.date, start, end)) continue;
    // 只挂着习惯的时间块（没有任务）也算习惯，不进事件流
    if (b.habitId && !b.task) continue;
    const habit = b.habitId ? habitById.get(b.habitId) : undefined;
    const people = b.task?.contact ? [b.task.contact] : [];
    const project = b.task?.project ?? habit?.project ?? null;
    const done = b.task?.completed || (b.habitId ? checked.has(`${b.habitId}:${b.date}`) : false);
    events.push(
      base({
        id: `block:${b.id}`,
        kind: "block",
        title: b.title,
        date: b.date,
        time: cleanTime(b.startTime),
        endTime: cleanTime(b.endTime),
        status: b.skipped ? "skipped" : done ? "done" : "open",
        people,
        project,
        sop: habitSop(habit) ?? sopFor(project, people),
        href: `/timeline?scale=day&date=${b.date}`,
        note: b.description,
        action: b.task
          ? { type: "task", id: b.task.id }
          : b.habitId
            ? { type: "habit", id: b.habitId, date: b.date }
            : null,
      })
    );
  }

  // 习惯不进事件流（在今日页打卡），事件流只放事情：任务、步骤、会议、时间块、专注记录
  for (const t of src.tasks) {
    const planned = t.scheduledDate ?? t.dueDate;
    let date: string | null = null;
    let overdueFrom: string | null = null;
    if (t.completed) {
      date = t.completedAt ? dayOf(t.completedAt) : planned;
    } else if (planned && planned < today) {
      date = today;
      overdueFrom = planned;
    } else {
      date = planned;
    }
    if (!inWindow(date, start, end)) continue;
    const people = t.contact ? [t.contact] : [];
    events.push(
      base({
        id: `task:${t.id}`,
        kind: "task",
        title: t.title,
        date,
        status: t.completed ? "done" : "open",
        overdueFrom,
        people,
        project: t.project,
        sop: sopFor(t.project, people),
        href: "/tasks",
        action: { type: "task", id: t.id },
      })
    );
  }

  for (const o of src.deadlines ?? []) {
    const overdue = o.deadline < today;
    const date = overdue ? today : o.deadline;
    if (!inWindow(date, start, end)) continue;
    events.push(
      base({
        id: `deadline:${o.id}`,
        kind: "deadline",
        title: `DDL · ${o.title}`,
        date,
        status: "open",
        overdueFrom: overdue ? o.deadline : null,
        project: o.project,
        href: `/opportunities?id=${o.id}`,
        note: o.nextAction,
      })
    );
  }

  for (const m of src.meetings) {
    if (!inWindow(m.meetingDate, start, end)) continue;
    const status: StreamStatus =
      m.status === "Cancelled"
        ? "skipped"
        : m.status === "Completed" || m.meetingDate < today
          ? "done"
          : "open";
    events.push(
      base({
        id: `meeting:${m.id}`,
        kind: "meeting",
        title: m.title,
        date: m.meetingDate,
        time: cleanTime(m.meetingTime),
        status,
        people: m.people,
        project: m.project,
        sop: sopFor(m.project, m.people),
        href: "/meetings",
        note: m.purpose,
        lowSignal: isLowSignal(m.people, m.project),
      })
    );
  }

  for (const log of src.contactLogs) {
    const date = dayOf(log.contactedAt);
    if (!inWindow(date, start, end)) continue;
    const time = format(log.contactedAt, "HH:mm");
    const people = [log.contact];
    events.push(
      base({
        id: `contact:${log.id}`,
        kind: "contact",
        title: `${CONTACT_LOG_LABEL[log.type] ?? "联系"} · ${log.contact.name}`,
        date,
        time: time === "00:00" ? null : time,
        status: "done",
        people,
        sop: sopFor(null, people),
        href: "/contacts",
        note: log.content,
        lowSignal: isLowSignal(people, null, log.contactHasProject),
      })
    );
  }

  for (const r of src.runs) {
    const date = r.status === "done" && r.completedAt ? dayOf(r.completedAt) : r.status === "active" ? today : null;
    if (!inWindow(date, start, end)) continue;
    const people = r.contact ? [r.contact] : [];
    events.push(
      base({
        id: `sop:${r.id}`,
        kind: "sop",
        title: r.title,
        date,
        status: r.status === "done" ? "done" : "open",
        people,
        project: r.project,
        sop: runSop(r),
        href: "/checklists",
        note: r.status === "active" ? `进行中 · 始于 ${dayOf(r.createdAt)}` : null,
      })
    );
  }

  // 整理房间：今天清哪里（来自房间清洁度），怎么清看全屋整理的方法
  if (src.room && src.room.tasks.length && inWindow(src.room.date, start, end)) {
    const done = new Set(src.room.done);
    const items = src.room.tasks.map((t) => ({
      id: t.key,
      text: `${t.zone}：${t.text}${t.minutes ? `（${t.minutes} 分钟）` : ""}`,
      done: done.has(t.key),
    }));
    const finished = items.filter((i) => i.done).length;
    const habit = src.habits.find((h) => /整理房间|房间|清洁|tidy/i.test(h.name));
    events.push(
      base({
        id: `room:${src.room.date}`,
        kind: "sop",
        title: "整理房间 · 今天的分区",
        date: src.room.date,
        time: cleanTime(habit?.startTime ?? null),
        endTime: cleanTime(habit?.endTime ?? null),
        status: finished === items.length ? "done" : "open",
        sop: {
          key: "room",
          title: "房间清洁",
          href: "/",
          text: ROOM_METHOD,
          roomDate: src.room.date,
          items,
          progress: { done: finished, total: items.length },
        },
        href: "/",
      })
    );
  }

  const overdueByProject = new Map<string, number>();
  for (const s of src.steps) {
    if (!s.done && s.scheduledDate && s.scheduledDate < today) {
      overdueByProject.set(s.project.id, (overdueByProject.get(s.project.id) ?? 0) + 1);
    }
  }
  const overdueShown = new Set<string>();

  for (const s of src.steps) {
    let date: string | null;
    let overdueFrom: string | null = null;
    let note = s.done ? s.feedback : s.detail;
    if (s.done) {
      date = s.doneDate;
    } else if (s.scheduledDate && s.scheduledDate < today) {
      // Only the next overdue step per project surfaces today; the backlog stays in /loop.
      if (overdueShown.has(s.project.id)) continue;
      overdueShown.add(s.project.id);
      date = today;
      overdueFrom = s.scheduledDate;
      const behind = (overdueByProject.get(s.project.id) ?? 1) - 1;
      if (behind > 0) note = `后面还有 ${behind} 步逾期${note ? ` · ${note}` : ""}`;
    } else {
      date = s.scheduledDate;
    }
    if (!inWindow(date, start, end)) continue;
    events.push(
      base({
        id: `step:${s.id}`,
        kind: "step",
        title: s.title,
        date,
        status: s.done ? "done" : "open",
        overdueFrom,
        project: s.project,
        sop: sopFor(s.project, []),
        // 点标题直接弹项目编辑窗（全局拦截 /projects?id=）
        href: `/projects?id=${s.project.id}`,
        note,
        action: { type: "step", id: s.id },
      })
    );
  }

  for (const f of src.focus) {
    if (!inWindow(f.date, start, end)) continue;
    const habit = habitById.get(f.habitId);
    events.push(
      base({
        id: `focus:${f.habitId}:${f.date}`,
        kind: "focus",
        title: `专注 · ${f.habitName}`,
        date: f.date,
        status: "done",
        project: habit?.project ?? null,
        sop: habitSop(habit),
        href: `/timeline?scale=day&date=${f.date}`,
        note: `${f.sessions} 轮 · ${f.minutes} 分钟`,
      })
    );
  }

  for (const m of src.moments ?? []) {
    if (!inWindow(m.date, start, end)) continue;
    events.push(
      base({
        id: `moment:${m.id}`,
        kind: "moment",
        title: m.title,
        date: m.date,
        time: m.time,
        endTime: m.endTime,
        status: m.running ? "open" : "done",
        href: "/stream",
        note: [m.running ? "计时中" : m.minutes != null ? `${m.minutes} 分钟` : null, m.projectName].filter(Boolean).join(" · ") || null,
      })
    );
  }

  return sortStream(events);
}

export function sortStream(events: StreamEvent[]): StreamEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return a.title.localeCompare(b.title, "zh");
  });
}

export type StreamFilter = { personId?: string | null; sopKey?: string | null; showLowSignal?: boolean };

export function filterStream(events: StreamEvent[], filter: StreamFilter): StreamEvent[] {
  return events.filter((e) => {
    if (!filter.showLowSignal && e.lowSignal) return false;
    if (filter.personId && !e.people.some((p) => p.id === filter.personId)) return false;
    if (filter.sopKey && e.sop?.key !== filter.sopKey) return false;
    return true;
  });
}

export type StreamDay = { date: string; events: StreamEvent[] };

export function groupStreamByDay(events: StreamEvent[]): StreamDay[] {
  const days = new Map<string, StreamEvent[]>();
  for (const e of events) {
    const list = days.get(e.date) ?? [];
    list.push(e);
    days.set(e.date, list);
  }
  return [...days.entries()].map(([date, list]) => ({ date, events: list }));
}

/** Facets for the person/SOP pickers, most frequent first. */
export function streamFacets(events: StreamEvent[]) {
  const people = new Map<string, { person: StreamPerson; count: number }>();
  const sops = new Map<string, { sop: StreamSop; count: number }>();
  for (const e of events) {
    for (const p of e.people) {
      const hit = people.get(p.id) ?? { person: p, count: 0 };
      hit.count += 1;
      people.set(p.id, hit);
    }
    if (e.sop) {
      const hit = sops.get(e.sop.key) ?? { sop: e.sop, count: 0 };
      hit.count += 1;
      sops.set(e.sop.key, hit);
    }
  }
  const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;
  return {
    people: [...people.values()].sort(
      (a, b) => byCount(a, b) || b.person.importance - a.person.importance
    ),
    sops: [...sops.values()].sort(byCount),
    lowSignal: events.filter((e) => e.lowSignal).length,
  };
}

/** Index of the first open event at or after the current time on today, for the "now" marker. */
export function nowIndex(events: StreamEvent[], nowHHmm: string): number {
  const idx = events.findIndex((e) => e.status === "open" && (!e.time || e.time >= nowHHmm));
  return idx === -1 ? events.length : idx;
}
