import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shiftWeek } from "@/lib/review-stats";
import { getWeekRange, getWeekStart } from "@/lib/reminders";
import {
  normalizePriorities,
  parsePriorities,
  serializePriorities,
  type WeeklyPriority,
} from "@/lib/weekly-plan";
import { format, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";

function weekLabel(weekStart: string) {
  const { start, end } = getWeekRange(parseISO(`${weekStart}T12:00:00`));
  return `${format(parseISO(`${start}T12:00:00`), "M月d日", { locale: zhCN })} – ${format(parseISO(`${end}T12:00:00`), "M月d日", { locale: zhCN })}`;
}

export async function GET(request: NextRequest) {
  const weekStartParam = request.nextUrl.searchParams.get("weekStart");
  const weekStart = weekStartParam || getWeekStart();

  const [plan, goals, projects] = await Promise.all([
    prisma.weeklyPlan.findUnique({ where: { weekStart } }),
    prisma.lifeGoal.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, title: true, area: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.project.findMany({
      where: { status: { in: ["ACTIVE", "PLANNING"] } },
      select: { id: true, name: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);

  const priorities = parsePriorities(plan?.priorities);
  const goalMap = Object.fromEntries(goals.map((g) => [g.id, g]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  return NextResponse.json({
    weekStart,
    weekLabel: weekLabel(weekStart),
    prev: shiftWeek(weekStart, -1),
    next: shiftWeek(weekStart, 1),
    intention: plan?.intention ?? null,
    priorities: priorities.map((p) => ({
      ...p,
      goal: p.goalId ? goalMap[p.goalId] ?? null : null,
      project: p.projectId ? projectMap[p.projectId] ?? null : null,
    })),
    goals,
    projects,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const weekStart = body.weekStart || getWeekStart();
  const intention = body.intention?.trim() || null;
  const priorities: WeeklyPriority[] = normalizePriorities(body.priorities ?? []);

  const plan = await prisma.weeklyPlan.upsert({
    where: { weekStart },
    create: {
      weekStart,
      intention,
      priorities: serializePriorities(priorities),
    },
    update: {
      intention,
      priorities: serializePriorities(priorities),
    },
  });

  return NextResponse.json({
    weekStart: plan.weekStart,
    intention: plan.intention,
    priorities: parsePriorities(plan.priorities),
  });
}
