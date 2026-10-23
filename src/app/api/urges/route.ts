import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateString, getWeekStart, getWeekRange } from "@/lib/utils";
import { computeSurfStreak, daysSinceLastEvent, DEFAULT_URGE_CATEGORIES } from "@/lib/urges";
import { parseISO, format, addDays } from "date-fns";
import { isUrgeRedirect } from "@/lib/urge-transfer";

async function ensureDefaultCategories() {
  const count = await prisma.urgeCategory.count();
  if (count > 0) return;
  await prisma.urgeCategory.createMany({
    data: DEFAULT_URGE_CATEGORIES.map((c, i) => ({
      name: c.name,
      color: c.color,
      goal: c.goal,
      isPrivate: c.isPrivate,
      sortOrder: i,
    })),
  });
}

export async function GET(request: NextRequest) {
  await ensureDefaultCategories();
  const { searchParams } = request.nextUrl;
  const weekStart = searchParams.get("weekStart") || getWeekStart();
  const includePrivate = searchParams.get("includePrivate") === "1";
  const { start, end } = getWeekRange(parseISO(`${weekStart}T12:00:00`));

  const categories = await prisma.urgeCategory.findMany({
    where: {
      isActive: true,
      ...(includePrivate ? {} : { isPrivate: false }),
    },
    orderBy: { sortOrder: "asc" },
    include: {
      events: {
        orderBy: { occurredAt: "desc" },
        take: 30,
      },
    },
  });

  const weekEvents = await prisma.urgeEvent.findMany({
    where: { date: { gte: start, lte: end }, ...(!includePrivate ? { category: { isPrivate: false } } : {}) },
    include: { category: { select: { name: true, color: true, isPrivate: true } } },
    orderBy: { occurredAt: "desc" },
  });

  const stats = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    color: cat.color,
    isPrivate: cat.isPrivate,
    goal: cat.goal,
    surfStreak: computeSurfStreak(cat.events),
    daysSinceLast: daysSinceLastEvent(cat.events),
    weekCount: weekEvents.filter((e) => e.categoryId === cat.id).length,
    weekSurfed: weekEvents.filter(
      (e) => e.categoryId === cat.id && (e.outcome === "surfed" || e.outcome === "redirected")
    ).length,
  }));

  return NextResponse.json({
    weekStart,
    categories: stats,
    recentEvents: weekEvents.slice(0, 20).map((e) => ({
      id: e.id,
      categoryId: e.categoryId,
      categoryName: e.category.name,
      categoryColor: e.category.color,
      occurredAt: e.occurredAt.toISOString(),
      intensity: e.intensity,
      trigger: e.trigger,
      outcome: e.outcome,
      note: e.note,
      date: e.date,
    })),
  });
}

export async function POST(request: NextRequest) {
  await ensureDefaultCategories();
  const body = await request.json();
  const date = body.date || toDateString();

  if (!body.categoryId || !body.outcome) {
    return NextResponse.json({ error: "categoryId and outcome required" }, { status: 400 });
  }

  const event = await prisma.urgeEvent.create({
    data: {
      categoryId: body.categoryId,
      intensity: body.intensity != null ? Number(body.intensity) : 3,
      trigger: body.trigger?.trim() || null,
      outcome: body.outcome,
      redirect: body.outcome === "redirected" && isUrgeRedirect(body.redirect) ? body.redirect : null,
      note: body.note?.trim() || null,
      date,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    },
  });

  return NextResponse.json(event, { status: 201 });
}
