import { NextRequest, NextResponse } from "next/server";
import { addDays, format, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buildEventStream, streamFacets } from "@/lib/event-stream";
import { parseRoomDone, roomStrategy } from "@/lib/room-plan";
import { roomZonesFor } from "@/lib/room-store";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 62;

const personSelect = { id: true, name: true, importance: true } as const;
const refSelect = { id: true, name: true } as const;

export async function GET(request: NextRequest) {
  const today = format(new Date(), "yyyy-MM-dd");
  const q = request.nextUrl.searchParams;
  const start = DATE_RE.test(q.get("start") ?? "")
    ? q.get("start")!
    : format(addDays(parseISO(`${today}T12:00:00`), -3), "yyyy-MM-dd");
  let end = DATE_RE.test(q.get("end") ?? "")
    ? q.get("end")!
    : format(addDays(parseISO(`${today}T12:00:00`), 7), "yyyy-MM-dd");
  if (end < start) end = start;
  const maxEnd = format(addDays(parseISO(`${start}T12:00:00`), MAX_SPAN_DAYS), "yyyy-MM-dd");
  if (end > maxEnd) end = maxEnd;

  const startAt = parseISO(`${start}T00:00:00`);
  const endAt = parseISO(`${end}T23:59:59.999`);
  const rollsOverdue = start <= today && today <= end;

  const [habits, habitCheckIns, blocks, tasks, meetings, contactLogs, runs, steps, pomodoros, opportunities] =
    await Promise.all([
      prisma.habit.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          startTime: true,
          endTime: true,
          scheduleMode: true,
          frequency: true,
          daysOfWeek: true,
          monthDays: true,
          project: { select: refSelect },
        },
      }),
      prisma.habitCheckIn.findMany({
        where: { date: { gte: start, lte: end } },
        select: { habitId: true, date: true, completed: true },
      }),
      prisma.dayScheduleBlock.findMany({
        where: { date: { gte: start, lte: end } },
        select: {
          id: true,
          date: true,
          title: true,
          description: true,
          startTime: true,
          endTime: true,
          skipped: true,
          habitId: true,
          task: {
            select: {
              id: true,
              completed: true,
              contact: { select: personSelect },
              project: { select: refSelect },
            },
          },
        },
      }),
      prisma.taskItem.findMany({
        where: {
          cancelled: false,
          OR: [
            { completed: true, completedAt: { gte: startAt, lte: endAt } },
            { scheduledDate: { gte: start, lte: end } },
            { scheduledDate: null, dueDate: { gte: start, lte: end } },
            ...(rollsOverdue
              ? [
                  { completed: false, scheduledDate: { lt: today } },
                  { completed: false, scheduledDate: null, dueDate: { lt: today } },
                ]
              : []),
          ],
        },
        select: {
          id: true,
          title: true,
          completed: true,
          completedAt: true,
          dueDate: true,
          scheduledDate: true,
          project: { select: refSelect },
          contact: { select: personSelect },
        },
      }),
      prisma.meeting.findMany({
        where: { meetingDate: { gte: start, lte: end } },
        select: {
          id: true,
          title: true,
          meetingDate: true,
          meetingTime: true,
          status: true,
          purpose: true,
          project: { select: refSelect },
          referrer: { select: personSelect },
          attendees: { select: { contact: { select: personSelect } } },
        },
      }),
      prisma.contactLog.findMany({
        where: { contactedAt: { gte: startAt, lte: endAt } },
        select: {
          id: true,
          type: true,
          content: true,
          contactedAt: true,
          contact: { select: { ...personSelect, _count: { select: { projects: true } } } },
        },
      }),
      prisma.checklistRun.findMany({
        where: {
          OR: [{ status: "active" }, { status: "done", completedAt: { gte: startAt, lte: endAt } }],
        },
        select: {
          id: true,
          title: true,
          status: true,
          items: true,
          createdAt: true,
          completedAt: true,
          template: { select: { id: true, title: true } },
          project: { select: refSelect },
          contact: { select: personSelect },
        },
      }),
      prisma.projectPlanStep.findMany({
        where: {
          OR: [
            { done: true, doneDate: { gte: start, lte: end } },
            { done: false, project: { status: "ACTIVE" }, scheduledDate: { gte: start, lte: end } },
            ...(rollsOverdue
              ? [{ done: false, project: { status: "ACTIVE" }, scheduledDate: { lt: today } }]
              : []),
          ],
        },
        orderBy: [{ scheduledDate: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          title: true,
          detail: true,
          done: true,
          doneDate: true,
          scheduledDate: true,
          feedback: true,
          project: { select: refSelect },
        },
      }),
      prisma.pomodoroSession.findMany({
        where: { date: { gte: start, lte: end }, status: "completed" },
        select: { habitId: true, date: true, actualMinutes: true, plannedMinutes: true, habit: { select: { name: true } } },
      }),
      // 机会 DDL：窗口内的，加上（看今天时）30 天内过期还没处理的
      prisma.opportunity.findMany({
        where: {
          status: { in: ["Watching", "Active"] },
          deadline: {
            not: null,
            gte: rollsOverdue ? format(addDays(parseISO(`${today}T12:00:00`), -30), "yyyy-MM-dd") : start,
            lte: end,
          },
        },
        select: { id: true, title: true, deadline: true, status: true, nextAction: true, project: { select: refSelect } },
      }),
    ]);

  const focus = new Map<string, { habitId: string; habitName: string; date: string; sessions: number; minutes: number }>();
  for (const s of pomodoros) {
    const key = `${s.habitId}:${s.date}`;
    const hit = focus.get(key) ?? { habitId: s.habitId, habitName: s.habit.name, date: s.date, sessions: 0, minutes: 0 };
    hit.sessions += 1;
    hit.minutes += s.actualMinutes ?? s.plannedMinutes;
    focus.set(key, hit);
  }

  const [roomZones, roomLog, freeTimers] = await Promise.all([
    roomZonesFor(today),
    prisma.dailyLog.findUnique({ where: { date: today }, select: { roomDone: true } }),
    prisma.eventTimer.findMany({
      where: { eventId: { startsWith: "free:" }, status: { not: "cancelled" }, startedAt: { gte: startAt, lte: endAt } },
      orderBy: { startedAt: "asc" },
    }),
  ]);
  const moments = freeTimers.map((t) => {
    const running = t.status !== "completed";
    return {
      id: t.id,
      title: t.title,
      date: format(t.startedAt, "yyyy-MM-dd"),
      time: format(t.startedAt, "HH:mm"),
      // 只记了一个时间点（「21:27 洗完澡」）就不显示结束和时长
      endTime: t.endedAt && +t.endedAt > +t.startedAt ? format(t.endedAt, "HH:mm") : null,
      minutes: t.endedAt && +t.endedAt > +t.startedAt ? Math.round((+t.endedAt - +t.startedAt) / 60000) : null,
      running,
      projectName: t.projectName,
    };
  });
  const room = {
    date: today,
    tasks: roomStrategy(roomZones)
      .filter((t) => t.tier !== "keep")
      .map(({ key, zone, text, minutes }) => ({ key, zone, text, minutes })),
    done: parseRoomDone(roomLog?.roomDone),
  };

  const events = buildEventStream({
    start,
    end,
    today,
    habits,
    habitCheckIns,
    blocks,
    tasks,
    meetings: meetings.map((m) => {
      const people = m.attendees.map((a) => a.contact);
      if (m.referrer && !people.some((p) => p.id === m.referrer!.id)) people.push(m.referrer);
      return { ...m, people };
    }),
    contactLogs: contactLogs.map(({ contact: { _count, ...contact }, ...log }) => ({
      ...log,
      contact,
      contactHasProject: _count.projects > 0,
    })),
    runs,
    steps,
    focus: [...focus.values()],
    deadlines: opportunities.map((o) => ({ ...o, deadline: o.deadline! })),
    room,
    moments,
  });

  return NextResponse.json({ start, end, today, events, facets: streamFacets(events) });
}
