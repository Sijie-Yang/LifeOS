import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/reminders";
import { parseGoalReflections } from "@/lib/period-review";
import { parsePriorities } from "@/lib/weekly-plan";
import {
  buildWeekStats,
  buildWeekStatsTrend,
  shiftWeek,
} from "@/lib/review-stats";

export async function GET(request: NextRequest) {
  try {
    const weekStartParam = new URL(request.url).searchParams.get("weekStart");
    const weekStart = weekStartParam || getWeekStart();

    const [{ stats, perHabit, activeGoals, weekLabel, start, end }, review, goals, weeklyPlan] =
      await Promise.all([
        buildWeekStats(weekStart),
        prisma.weeklyReview.findUnique({ where: { weekStart } }),
        prisma.lifeGoal.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, title: true },
        }),
        prisma.weeklyPlan.findUnique({ where: { weekStart } }),
      ]);

    const goalTitleMap = Object.fromEntries(goals.map((g) => [g.id, g.title]));

    const pastReviews = await prisma.weeklyReview.findMany({
      where: { weekStart: { not: weekStart } },
      orderBy: { weekStart: "desc" },
      take: 8,
    });

    const goalReflections = review ? parseGoalReflections(review.goalReflections) : [];
    const statsTrend = await buildWeekStatsTrend(weekStart, 12);
    const planPriorities = parsePriorities(weeklyPlan?.priorities);

    return NextResponse.json({
      weekStart,
      weekLabel,
      start,
      end,
      prev: shiftWeek(weekStart, -1),
      next: shiftWeek(weekStart, 1),
      stats,
      statsTrend,
      perHabit,
      activeGoals,
      goalReflections,
      weeklyPlan: weeklyPlan
        ? {
            intention: weeklyPlan.intention,
            priorities: planPriorities,
            completedCount: planPriorities.filter((p) => p.completed).length,
            totalCount: planPriorities.length,
          }
        : null,
      review: review
        ? {
            wins: review.wins,
            improvements: review.improvements,
            nextFocus: review.nextFocus,
            goalReflections,
          }
        : null,
      pastReviews: pastReviews.map((r) => ({
        weekStart: r.weekStart,
        wins: r.wins,
        improvements: r.improvements,
        nextFocus: r.nextFocus,
        goalReflections: parseGoalReflections(r.goalReflections).map((gr) => ({
          ...gr,
          goalTitle: goalTitleMap[gr.goalId] || "目标",
        })),
      })),
    });
  } catch (error) {
    console.error("[review GET]", error);
    return NextResponse.json(
      { error: "加载复盘数据失败，请重启开发服务器后重试" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const weekStart = body.weekStart || getWeekStart();
  const goalReflections = JSON.stringify(body.goalReflections ?? []);

  const review = await prisma.weeklyReview.upsert({
    where: { weekStart },
    create: {
      weekStart,
      wins: body.wins || null,
      improvements: body.improvements || null,
      nextFocus: body.nextFocus || null,
      goalReflections,
    },
    update: {
      wins: body.wins || null,
      improvements: body.improvements || null,
      nextFocus: body.nextFocus || null,
      goalReflections,
    },
  });
  return NextResponse.json(review);
}
