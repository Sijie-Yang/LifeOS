import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/utils";
import {
  isHabitScheduledOnDateForHabit,
  getWeekStart,
  getWeekRange,
  getScheduledDatesInWeekForHabit,
  getAllScheduledDatesInWeekForHabit,
} from "@/lib/reminders";
import { isHabitPowerValue, suggestHabitPower } from "@/lib/life-powers";
import { applyHabitScheduleSync, inferScheduleMode } from "@/lib/habit-schedule-sync";
import { addDays, format, parseISO } from "date-fns";

const habitInclude = {
  project: true,
} as const;

function habitDataFromBody(body: Record<string, unknown>, existing?: { scheduleMode: string; startTime: string | null; endTime: string | null; frequency: string }) {
  const scheduleMode = inferScheduleMode({
    scheduleMode: body.scheduleMode ?? existing?.scheduleMode,
    startTime: (body.startTime as string | null | undefined) ?? existing?.startTime,
    endTime: (body.endTime as string | null | undefined) ?? existing?.endTime,
    frequency: (body.frequency as string | undefined) ?? existing?.frequency,
  });

  return {
    ...(body.name !== undefined && { name: body.name as string }),
    ...(body.description !== undefined && { description: (body.description as string) || null }),
    ...(body.projectId !== undefined && { projectId: (body.projectId as string) || null }),
    ...(body.frequency !== undefined && { frequency: body.frequency as string }),
    scheduleMode,
    ...(body.daysOfWeek !== undefined && { daysOfWeek: JSON.stringify(body.daysOfWeek) }),
    ...(body.monthDays !== undefined && { monthDays: JSON.stringify(body.monthDays) }),
    ...(body.startTime !== undefined && { startTime: (body.startTime as string) || null }),
    ...(body.endTime !== undefined && { endTime: (body.endTime as string) || null }),
    ...(body.color !== undefined && { color: body.color as string }),
    ...(body.isActive !== undefined && { isActive: body.isActive as boolean }),
    ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder as number }),
    ...(body.minimumVersion !== undefined && { minimumVersion: (body.minimumVersion as string)?.trim() || null }),
    ...(body.cue !== undefined && { cue: (body.cue as string)?.trim() || null }),
    ...(body.power !== undefined && { power: isHabitPowerValue(body.power as string) ? (body.power as string) : null }),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const view = searchParams.get("view") || "today";
  const today = toDateString();

  if (view === "all") {
    const weekStart = getWeekStart();
    const { start, end } = getWeekRange();
    const habits = await prisma.habit.findMany({
      include: {
        ...habitInclude,
        checkIns: { where: { date: { gte: start, lte: end }, completed: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const habitsWithStats = habits.map((h) => {
      const weekPlan = getAllScheduledDatesInWeekForHabit(h, weekStart);
      const weekDue = getScheduledDatesInWeekForHabit(h, weekStart, today);
      const done = h.checkIns.filter((c) => weekPlan.includes(c.date)).length;
      return {
        ...h,
        weekDone: done,
        weekExpected: weekPlan.length,
        weekDue: weekDue.length,
      };
    });

    return NextResponse.json({ view: "all", habits: habitsWithStats, totalActive: habits.length });
  }

  if (view === "week") {
    const weekStart = searchParams.get("weekStart") || getWeekStart();
    const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
    const habits = await prisma.habit.findMany({
      where: { isActive: true },
      include: {
        ...habitInclude,
        checkIns: { where: { date: { gte: weekStart, lte: weekEnd }, completed: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      view: "week",
      weekStart,
      weekEnd,
      habits,
      totalActive: habits.length,
    });
  }

  // today
  const date = searchParams.get("date") || today;
  const allHabits = await prisma.habit.findMany({
    where: { isActive: true },
    include: {
      ...habitInclude,
      checkIns: { where: { date } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const habits = allHabits.filter((h) => isHabitScheduledOnDateForHabit(h, date));

  return NextResponse.json({ view: "today", habits, date, totalActive: allHabits.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = habitDataFromBody(body);
  const maxSort = await prisma.habit.aggregate({ _max: { sortOrder: true } });
  const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  const habit = await prisma.habit.create({
    data: {
      name: body.name,
      description: body.description || null,
      projectId: body.projectId || null,
      // 九力归属：创建即锁定；未指定时按名字给默认值
      power: data.power !== undefined ? data.power : suggestHabitPower(String(body.name ?? "")),
      frequency: body.frequency || "DAILY",
      scheduleMode: data.scheduleMode ?? "none",
      daysOfWeek: JSON.stringify(body.daysOfWeek || [1, 2, 3, 4, 5, 6, 0]),
      monthDays: JSON.stringify(body.monthDays || [1]),
      startTime: body.startTime || null,
      endTime: body.endTime || null,
      color: body.color || "#10b981",
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? nextSortOrder,
    },
    include: { project: true },
  });

  await applyHabitScheduleSync(prisma, habit.id, habit.scheduleMode);

  const synced = await prisma.habit.findUnique({
    where: { id: habit.id },
    include: { project: true },
  });
  return NextResponse.json(synced, { status: 201 });
}
