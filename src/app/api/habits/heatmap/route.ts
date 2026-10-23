import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isHabitScheduledOnDateForHabit } from "@/lib/reminders";

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get("year") || String(new Date().getFullYear()), 10);
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [habits, checkIns] = await Promise.all([
    prisma.habit.findMany({ where: { isActive: true } }),
    prisma.habitCheckIn.findMany({
      where: { date: { gte: start, lte: end }, completed: true },
    }),
  ]);

  const checkInsByDate = new Map<string, Set<string>>();
  for (const c of checkIns) {
    if (!checkInsByDate.has(c.date)) checkInsByDate.set(c.date, new Set());
    checkInsByDate.get(c.date)!.add(c.habitId);
  }

  const entries: Array<{ date: string; done: number; expected: number; rate: number }> = [];

  for (let m = 1; m <= 12; m++) {
    const daysInMonth = new Date(year, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (dateStr > new Date().toISOString().slice(0, 10)) break;

      const scheduled = habits.filter((h) => isHabitScheduledOnDateForHabit(h, dateStr));
      if (scheduled.length === 0) continue;

      const doneSet = checkInsByDate.get(dateStr) || new Set();
      const done = scheduled.filter((h) => doneSet.has(h.id)).length;
      entries.push({
        date: dateStr,
        done,
        expected: scheduled.length,
        rate: Math.round((done / scheduled.length) * 100),
      });
    }
  }

  return NextResponse.json({ year, entries });
}
