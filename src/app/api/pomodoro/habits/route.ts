import { NextRequest, NextResponse } from "next/server";
import { parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/utils";
import { isHabitScheduledOnDateForHabit } from "@/lib/reminders";
import {
  configuredPomodoroHabits,
  pomodoroDisplayName,
} from "@/lib/pomodoro-habits";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") || toDateString();
  const dayOfWeek = parseISO(`${date}T12:00:00`).getDay();
  const ids = configuredPomodoroHabits();
  const order = new Map<string, number>(ids.map((id, i) => [id, i]));

  const [habits, blocks] = await Promise.all([
    prisma.habit.findMany({
      where: { ...(ids.length ? { id: { in: ids } } : {}), isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        startTime: true,
        endTime: true,
        frequency: true,
        scheduleMode: true,
        daysOfWeek: true,
        monthDays: true,
      },
    }),
    prisma.scheduleBlock.findMany({
      where: {
        ...(ids.length ? { habitId: { in: ids } } : { habitId: { not: null } }),
        isActive: true,
        dayOfWeek,
      },
      select: { habitId: true, startTime: true, endTime: true },
    }),
  ]);

  const timesByHabit = new Map<string, { startTime: string; endTime: string }>();
  for (const block of blocks) {
    if (!block.habitId) continue;
    const current = timesByHabit.get(block.habitId);
    if (!current) {
      timesByHabit.set(block.habitId, { startTime: block.startTime, endTime: block.endTime });
      continue;
    }
    if (block.startTime < current.startTime) current.startTime = block.startTime;
    if (block.endTime > current.endTime) current.endTime = block.endTime;
  }

  const mapped = habits
    .map((h) => {
      const today = timesByHabit.get(h.id);
      return {
        ...h,
        name: pomodoroDisplayName(h.id, h.name),
        startTime: today?.startTime ?? h.startTime,
        endTime: today?.endTime ?? h.endTime,
      };
    })
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  const scheduled = mapped.filter((h) => isHabitScheduledOnDateForHabit(h, date));
  const other = mapped.filter((h) => !isHabitScheduledOnDateForHabit(h, date));

  return NextResponse.json({
    date,
    scheduled,
    other,
    habits: mapped,
  });
}
