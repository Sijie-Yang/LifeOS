import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/utils";
import { isHabitScheduledOnDateForHabit } from "@/lib/reminders";
import { URGE_TRANSFER_CATEGORY, isTransfer } from "@/lib/urge-transfer";
import { bucketTrend, clockHours, parseTrendRange, trendDates, type TrendDay } from "@/lib/day-trend";

/** GET ?range=week|month|year&date=YYYY-MM-DD → { range, points } */
export async function GET(request: NextRequest) {
  const range = parseTrendRange(request.nextUrl.searchParams.get("range"));
  const end = request.nextUrl.searchParams.get("date") || toDateString();
  const dates = trendDates(range, end);
  // 多取前一天：第一天的「昨晚就寝」记在前一天的 sleepTime
  const from = format(subDays(new Date(`${dates[0]}T12:00:00`), 1), "yyyy-MM-dd");

  const [logs, habits, checkIns] = await Promise.all([
    prisma.dailyLog.findMany({
      where: { date: { gte: from, lte: end } },
      select: {
        date: true,
        sleepHours: true,
        energyMorning: true,
        energyEvening: true,
        drainMorning: true,
        drainEvening: true,
        planScore: true,
        sleepTime: true,
        wakeTime: true,
        weightKg: true,
        exerciseStartTime: true,
        exerciseMinutes: true,
        exerciseCalories: true,
        urgeMorning: true,
      },
    }),
    // 只算启用中的习惯，且从创建那天开始算
    prisma.habit.findMany({ where: { isActive: true } }),
    prisma.habitCheckIn.findMany({
      where: { date: { gte: from, lte: end }, completed: true, level: { not: "skip" } },
      select: { habitId: true, date: true },
    }),
  ]);
  const [urgeEvents, oldUrgeHabit, pomodoros] = await Promise.all([
    prisma.urgeEvent.findMany({
      where: { date: { gte: from, lte: end }, category: { name: URGE_TRANSFER_CATEGORY } },
      select: { date: true, outcome: true },
    }),
    // 同名习惯（「冲动转化」）的打卡 = 那天守住了
    prisma.habitCheckIn.findMany({
      where: { date: { gte: from, lte: end }, completed: true, habit: { name: URGE_TRANSFER_CATEGORY } },
      select: { date: true },
    }),
    prisma.pomodoroSession.findMany({
      where: { date: { gte: from, lte: end }, status: "completed" },
      select: { date: true, actualMinutes: true, plannedMinutes: true },
    }),
  ]);
  const oldKept = new Set(oldUrgeHabit.map((c) => c.date));
  const logMap = new Map(logs.map((l) => [l.date, l]));
  const checked = new Set(checkIns.map((c) => `${c.habitId}:${c.date}`));

  const days: TrendDay[] = dates.map((date) => {
    const log = logMap.get(date);
    const prev = logMap.get(format(subDays(new Date(`${date}T12:00:00`), 1), "yyyy-MM-dd"));
    const scheduled = habits.filter(
      (h) => format(h.createdAt, "yyyy-MM-dd") <= date && isHabitScheduledOnDateForHabit(h, date)
    );
    const done = scheduled.filter((h) => checked.has(`${h.id}:${date}`)).length;
    return {
      date,
      sleepHours: log?.sleepHours != null ? Math.round(log.sleepHours * 10) / 10 : null,
      energyMorning: log?.energyMorning ?? null,
      energyEvening: log?.energyEvening ?? null,
      drainMorning: log?.drainMorning ?? null,
      drainEvening: log?.drainEvening ?? null,
      // 未来的日子不算；没有排习惯的日子留空
      habitRate: date > toDateString() || scheduled.length === 0 ? null : Math.round((done / scheduled.length) * 100),
      planScore: log?.planScore ?? null,
      bedtime: clockHours(prev?.sleepTime, true),
      wakeTime: clockHours(log?.wakeTime, false),
      weightKg: log?.weightKg ?? null,
      exerciseStart: clockHours(log?.exerciseStartTime, false),
      exerciseMinutes: log?.exerciseMinutes ?? null,
      exerciseCalories: log?.exerciseCalories ?? null,
      ...urgeDay(date, log?.urgeMorning ?? null),
      focusMinutes: date > toDateString() ? null : pomodoros
        .filter((p) => p.date === date)
        .reduce((sum, p) => sum + (p.actualMinutes ?? p.plannedMinutes), 0),
    };
  });

  /** 冲动 · 转化：强度、冲动次数、转移成功率（没冲动的日子留空）、守住（有记录且没破戒 = 100，破戒 = 0） */
  function urgeDay(date: string, morning: number | null) {
    const events = urgeEvents.filter((e) => e.date === date);
    const broke = events.some((e) => e.outcome === "gave_in");
    const recorded = morning != null || events.length > 0 || oldKept.has(date);
    return {
      urgeMorning: morning,
      urgeCount: date > toDateString() ? null : events.length,
      transferRate: events.length ? Math.round((events.filter(isTransfer).length / events.length) * 100) : null,
      keptRate: broke ? 0 : recorded ? 100 : null,
    };
  }

  return NextResponse.json({ range, points: bucketTrend(range, days) });
}
