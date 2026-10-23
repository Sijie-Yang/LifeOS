import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/utils";
import { isPomodoroHabitId, pomodoroDisplayName } from "@/lib/pomodoro-habits";

const habitSelect = {
  id: true,
  name: true,
  color: true,
  startTime: true,
  endTime: true,
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date") || toDateString();
  const habitId = searchParams.get("habitId");
  const summary = searchParams.get("summary") === "1";

  if (summary) {
    const sessions = await prisma.pomodoroSession.findMany({
      where: { date, status: "completed" },
      include: { habit: { select: habitSelect } },
      orderBy: { startedAt: "asc" },
    });

    const totalCount = sessions.length;
    const totalMinutes = sessions.reduce((s, x) => s + (x.actualMinutes ?? 0), 0);
    const byHabit = new Map<
      string,
      { habitId: string; name: string; color: string; count: number; minutes: number }
    >();

    for (const session of sessions) {
      const existing = byHabit.get(session.habitId);
      const minutes = session.actualMinutes ?? 0;
      if (existing) {
        existing.count += 1;
        existing.minutes += minutes;
      } else {
        byHabit.set(session.habitId, {
          habitId: session.habitId,
          name: pomodoroDisplayName(session.habitId, session.habit.name),
          color: session.habit.color,
          count: 1,
          minutes,
        });
      }
    }

    return NextResponse.json({
      date,
      totalCount,
      totalMinutes,
      byHabit: [...byHabit.values()],
      sessions: sessions.map((s) => ({
        id: s.id,
        habitId: s.habitId,
        habit: {
          ...s.habit,
          name: pomodoroDisplayName(s.habitId, s.habit.name),
        },
        actualMinutes: s.actualMinutes,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
      })),
    });
  }

  const where = {
    date,
    ...(habitId ? { habitId } : {}),
    ...(searchParams.get("status") ? { status: searchParams.get("status")! } : {}),
  };

  const sessions = await prisma.pomodoroSession.findMany({
    where,
    include: { habit: { select: habitSelect } },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json({ date, sessions });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const habitId = body.habitId as string | undefined;
  if (!habitId) {
    return NextResponse.json({ error: "必须选择番茄钟" }, { status: 400 });
  }

  if (!isPomodoroHabitId(habitId)) {
    return NextResponse.json({ error: "此习惯不在已配置的番茄钟列表中" }, { status: 400 });
  }

  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit || !habit.isActive) {
    return NextResponse.json({ error: "习惯不存在或已停用" }, { status: 404 });
  }

  const date = (body.date as string) || toDateString();
  const plannedMinutes = body.plannedMinutes ?? 25;

  const session = await prisma.pomodoroSession.create({
    data: {
      habitId,
      date,
      plannedMinutes,
      preEnergy: body.preEnergy != null ? Number(body.preEnergy) : null,
      startedAt: new Date(),
      status: "running",
    },
    include: { habit: { select: habitSelect } },
  });

  return NextResponse.json(session, { status: 201 });
}
