import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import { OPPORTUNITY_CLOSED_STATUSES } from "./utils";

export type CalendarWeekBlock = {
  id: string;
  date: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  color: string;
  kind: "habit" | "meeting" | "custom" | "task" | "opportunity";
  habitId: string | null;
  scheduleBlockId: string | null;
  meetingId: string | null;
  taskId: string | null;
  opportunityId: string | null;
  materialized: boolean;
  skipped: boolean;
  checked: boolean;
  timeOverridden: boolean;
  allDay: boolean;
  cue: string | null;
  minimumVersion: string | null;
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  meetingStatus: string | null;
};

export type CalendarWeekDay = {
  date: string;
  dayOfWeek: number;
  blocks: CalendarWeekBlock[];
};

export type CalendarWeekPayload = {
  weekStart: string;
  weekEnd: string;
  today: string;
  days: CalendarWeekDay[];
};

export type WeekMeetingSource = {
  id: string;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  durationMin: string | null;
  purpose: string | null;
  content: string | null;
  status: string;
};

export type WeekTaskSource = {
  id: string;
  title: string;
  scheduledDate: string | null;
  dueDate: string | null;
  completed: boolean;
  cancelled: boolean;
};

export type WeekOpportunitySource = {
  id: string;
  title: string;
  deadline: string | null;
  status: string;
  nextAction: string | null;
};

export type WeekTaskBlockSource = {
  id: string;
  date: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  color: string;
  taskId: string;
  skipped: boolean;
};

export type WeekAppointmentSources = {
  meetings: WeekMeetingSource[];
  tasks: WeekTaskSource[];
  opportunities: WeekOpportunitySource[];
  taskBlocks: WeekTaskBlockSource[];
};

const HIDDEN_OPPORTUNITY_STATUSES = new Set<string>(
  OPPORTUNITY_CLOSED_STATUSES.filter((status) => status !== "Won")
);

function addMinutesToTime(start: string, minutes: number): string {
  const [h, m] = start.slice(0, 5).split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function meetingEndTime(meetingTime: string, durationMin: string | null): string {
  const start = meetingTime.slice(0, 5);
  const mins = Number.parseInt(durationMin || "60", 10);
  return addMinutesToTime(start, Number.isFinite(mins) && mins > 0 ? mins : 60);
}

/** YYYY-MM-DD prefix, when the value actually starts with a calendar date. */
export function calendarDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/** Clock time when the value contains HH:mm. A bare date is not a clock time. */
export function clockTimeKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/(?:^|[\sT])(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function inWeek(date: string | null, weekStart: string, weekEnd: string): date is string {
  return Boolean(date && date >= weekStart && date <= weekEnd);
}

function emptyBlock(
  partial: Pick<CalendarWeekBlock, "id" | "date" | "title" | "startTime" | "endTime" | "color" | "kind"> &
    Partial<CalendarWeekBlock>
): CalendarWeekBlock {
  return {
    description: null,
    habitId: null,
    scheduleBlockId: null,
    meetingId: null,
    taskId: null,
    opportunityId: null,
    materialized: true,
    skipped: false,
    checked: false,
    timeOverridden: false,
    allDay: false,
    cue: null,
    minimumVersion: null,
    defaultStartTime: null,
    defaultEndTime: null,
    meetingStatus: null,
    ...partial,
  };
}

/**
 * Week grid appointments: opportunities, meetings, and tasks that have a date.
 * A clock time lands on the hour grid. A date without a clock is all-day.
 * Habits and project plan steps are not inputs.
 */
export function buildWeekAppointments(
  dates: string[],
  input: WeekAppointmentSources
): CalendarWeekDay[] {
  const weekStart = dates[0] ?? "";
  const weekEnd = dates[dates.length - 1] ?? weekStart;
  const blocksByDate = new Map<string, CalendarWeekBlock[]>(dates.map((date) => [date, []]));

  const timedTaskIds = new Set<string>();
  for (const block of input.taskBlocks) {
    if (!inWeek(block.date, weekStart, weekEnd)) continue;
    const start = clockTimeKey(block.startTime);
    const end = clockTimeKey(block.endTime);
    if (!start || !end) continue;
    timedTaskIds.add(block.taskId);
    blocksByDate.get(block.date)?.push(
      emptyBlock({
        id: block.id,
        date: block.date,
        title: block.title,
        description: block.description,
        startTime: start,
        endTime: end,
        color: block.color || "#6366f1",
        kind: "task",
        taskId: block.taskId,
        skipped: block.skipped,
        defaultStartTime: start,
        defaultEndTime: end,
      })
    );
  }

  for (const task of input.tasks) {
    if (task.cancelled || timedTaskIds.has(task.id)) continue;
    const scheduled = calendarDateKey(task.scheduledDate);
    const due = calendarDateKey(task.dueDate);
    const date = inWeek(scheduled, weekStart, weekEnd)
      ? scheduled
      : inWeek(due, weekStart, weekEnd)
        ? due
        : null;
    if (!date) continue;
    const source = date === scheduled ? task.scheduledDate : task.dueDate;
    const clock = clockTimeKey(source);
    const start = clock ?? "";
    const end = clock ? addMinutesToTime(clock, 60) : "";
    blocksByDate.get(date)?.push(
      emptyBlock({
        id: `task:${task.id}`,
        date,
        title: task.title,
        startTime: start,
        endTime: end,
        color: task.completed ? "#94a3b8" : "#6366f1",
        kind: "task",
        taskId: task.id,
        checked: task.completed,
        allDay: !clock,
        defaultStartTime: start || null,
        defaultEndTime: end || null,
      })
    );
  }

  for (const meeting of input.meetings) {
    if (meeting.status === "Cancelled") continue;
    const date = calendarDateKey(meeting.meetingDate);
    if (!inWeek(date, weekStart, weekEnd)) continue;
    const clock = clockTimeKey(meeting.meetingTime);
    const done = meeting.status === "Completed";
    const start = clock ?? "";
    const end = clock ? meetingEndTime(clock, meeting.durationMin) : "";
    blocksByDate.get(date)?.push(
      emptyBlock({
        id: `meeting:${meeting.id}`,
        date,
        title: meeting.title,
        description: meeting.purpose ?? meeting.content,
        startTime: start,
        endTime: end,
        color: done ? "#94a3b8" : "#0ea5e9",
        kind: "meeting",
        meetingId: meeting.id,
        checked: done,
        allDay: !clock,
        defaultStartTime: start || null,
        defaultEndTime: end || null,
        meetingStatus: meeting.status,
      })
    );
  }

  for (const opp of input.opportunities) {
    if (HIDDEN_OPPORTUNITY_STATUSES.has(opp.status)) continue;
    const date = calendarDateKey(opp.deadline);
    if (!inWeek(date, weekStart, weekEnd)) continue;
    const clock = clockTimeKey(opp.deadline);
    const won = opp.status === "Won";
    const start = clock ?? "";
    const end = clock ? addMinutesToTime(clock, 60) : "";
    blocksByDate.get(date)?.push(
      emptyBlock({
        id: `opportunity:${opp.id}`,
        date,
        title: opp.title,
        description: opp.nextAction,
        startTime: start,
        endTime: end,
        color: won ? "#94a3b8" : "#d97706",
        kind: "opportunity",
        opportunityId: opp.id,
        checked: won,
        allDay: !clock,
        defaultStartTime: start || null,
        defaultEndTime: end || null,
      })
    );
  }

  return dates.map((date) => ({
    date,
    dayOfWeek: parseISO(`${date}T12:00:00`).getDay(),
    blocks: (blocksByDate.get(date) ?? []).sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title);
    }),
  }));
}

export function getWeekStartMonday(dateStr: string): string {
  const d = parseISO(`${dateStr}T12:00:00`);
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export async function fetchCalendarWeek(
  prisma: PrismaClient,
  weekStartInput: string
): Promise<CalendarWeekPayload> {
  const weekStart = getWeekStartMonday(weekStartInput);
  const weekEnd = format(addDays(parseISO(`${weekStart}T12:00:00`), 6), "yyyy-MM-dd");
  const weekEndExclusive = format(addDays(parseISO(`${weekStart}T12:00:00`), 7), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const dates = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(`${weekStart}T12:00:00`), i), "yyyy-MM-dd")
  );

  const [meetings, tasks, opportunities, taskBlocks] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        meetingDate: { gte: weekStart, lt: weekEndExclusive },
        status: { not: "Cancelled" },
      },
      orderBy: [{ meetingDate: "asc" }, { meetingTime: "asc" }],
    }),
    prisma.taskItem.findMany({
      where: {
        cancelled: false,
        OR: [
          { scheduledDate: { gte: weekStart, lt: weekEndExclusive } },
          { dueDate: { gte: weekStart, lt: weekEndExclusive } },
        ],
      },
    }),
    prisma.opportunity.findMany({
      where: {
        deadline: { gte: weekStart, lt: weekEndExclusive },
        status: { notIn: [...HIDDEN_OPPORTUNITY_STATUSES] },
      },
    }),
    prisma.dayScheduleBlock.findMany({
      where: {
        date: { gte: weekStart, lte: weekEnd },
        taskId: { not: null },
        habitId: null,
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  return {
    weekStart,
    weekEnd,
    today,
    days: buildWeekAppointments(dates, {
      meetings,
      tasks,
      opportunities,
      taskBlocks: taskBlocks.flatMap((block) =>
        block.taskId
          ? [
              {
                id: block.id,
                date: block.date,
                title: block.title,
                description: block.description,
                startTime: block.startTime,
                endTime: block.endTime,
                color: block.color,
                taskId: block.taskId,
                skipped: block.skipped,
              },
            ]
          : []
      ),
    }),
  };
}
