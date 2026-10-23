import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateString, getWeekStart } from "@/lib/utils";
import { parseMustDo } from "@/lib/accountability";
import { isHabitScheduledOnDateForHabit } from "@/lib/reminders";
import { parsePriorities } from "@/lib/weekly-plan";

/** Aggregated briefing payload for morning/evening nudges and /briefing page */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") || toDateString();
  const weekStart = getWeekStart(new Date(`${date}T12:00:00`));

  const [log, allHabits, todayCheckIns, tasks, meetings, scheduleBlocks, weeklyPlan] =
    await Promise.all([
      prisma.dailyLog.findUnique({ where: { date } }),
      prisma.habit.findMany({ where: { isActive: true } }),
      prisma.habitCheckIn.findMany({ where: { date, completed: true } }),
      prisma.taskItem.findMany({
        where: {
          cancelled: false,
          OR: [{ dueDate: date }, { scheduledDate: date }],
          completed: false,
        },
        take: 10,
      }),
      prisma.meeting.findMany({
        where: { meetingDate: date },
        include: { attendees: { include: { contact: { select: { name: true } } } } },
        orderBy: { meetingTime: "asc" },
      }),
      prisma.scheduleBlock.findMany({
        where: { isActive: true, dayOfWeek: new Date(`${date}T12:00:00`).getDay() },
      }),
      prisma.weeklyPlan.findUnique({ where: { weekStart } }),
    ]);

  const checkedIds = new Set(todayCheckIns.map((c) => c.habitId));
  const habits = allHabits.filter((h) => isHabitScheduledOnDateForHabit(h, date));
  const uncheckedHabits = habits.filter((h) => !checkedIds.has(h.id));
  const mustDo = parseMustDo(log?.mustDo);
  const priorities = parsePriorities(weeklyPlan?.priorities);

  return NextResponse.json({
    date,
    weekStart,
    intention: weeklyPlan?.intention ?? null,
    priorities: priorities.filter((p) => !p.completed),
    mustDoCount: mustDo.length,
    habitsTotal: habits.length,
    habitsDone: habits.length - uncheckedHabits.length,
    uncheckedHabits: uncheckedHabits.map((h) => h.name),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority })),
    meetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      meetingTime: m.meetingTime,
      attendees: m.attendees.map((a) => a.contact.name),
    })),
    schedule: scheduleBlocks.map((b) => ({
      title: b.title,
      startTime: b.startTime,
      endTime: b.endTime,
    })),
    closed: Boolean(log?.closedAt),
    hasWellness: log?.energy != null || log?.mood != null,
  });
}
