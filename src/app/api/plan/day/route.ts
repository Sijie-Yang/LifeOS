import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  normalizePriorities,
  parsePriorities,
  serializePriorities,
  type WeeklyPriority,
} from "@/lib/weekly-plan";

function dateKey(value: string | null | undefined): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return format(new Date(), "yyyy-MM-dd");
}

export async function GET(request: NextRequest) {
  const date = dateKey(request.nextUrl.searchParams.get("date"));

  const [plan, goals, projects] = await Promise.all([
    prisma.dailyPlan.findUnique({ where: { date } }),
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
    date,
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
  const date = dateKey(body.date);
  const intention = body.intention?.trim() || null;
  const priorities: WeeklyPriority[] = normalizePriorities(body.priorities ?? []);

  const plan = await prisma.dailyPlan.upsert({
    where: { date },
    create: {
      date,
      intention,
      priorities: serializePriorities(priorities),
    },
    update: {
      intention,
      priorities: serializePriorities(priorities),
    },
  });

  return NextResponse.json({
    date: plan.date,
    intention: plan.intention,
    priorities: parsePriorities(plan.priorities),
  });
}
