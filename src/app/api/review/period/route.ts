import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildPeriodStats,
  getPeriodRange,
  parseGoalReflections,
  shiftPeriod,
  type PeriodType,
} from "@/lib/period-review";
import { buildPeriodStatsTrend } from "@/lib/review-stats";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodType = (searchParams.get("type") || "month") as PeriodType;
    const periodKeyParam = searchParams.get("key");

    const current = periodKeyParam
      ? (() => {
          if (periodType === "month") {
            const [y, m] = periodKeyParam.split("-").map(Number);
            return getPeriodRange("month", new Date(y, m - 1, 1));
          }
          if (periodType === "quarter") {
            const [yStr, qStr] = periodKeyParam.split("-Q");
            return getPeriodRange("quarter", new Date(Number(yStr), (Number(qStr) - 1) * 3, 1));
          }
          return getPeriodRange("year", new Date(Number(periodKeyParam), 0, 1));
        })()
      : getPeriodRange(periodType);

    const [stats, review, pastReviews, goals] = await Promise.all([
      buildPeriodStats(current.start, current.end),
      prisma.periodReview.findUnique({
        where: { periodType_periodKey: { periodType, periodKey: current.periodKey } },
      }),
      prisma.periodReview.findMany({
        where: { periodType, periodKey: { not: current.periodKey } },
        orderBy: { periodKey: "desc" },
        take: 6,
      }),
      prisma.lifeGoal.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, title: true },
      }),
    ]);

    const goalTitleMap = Object.fromEntries(goals.map((g) => [g.id, g.title]));
    const goalReflections = review ? parseGoalReflections(review.goalReflections) : [];
    const statsTrend = await buildPeriodStatsTrend(periodType, current.periodKey, 12);

    return NextResponse.json({
      periodType,
      periodKey: current.periodKey,
      periodLabel: current.periodLabel,
      start: current.start,
      end: current.end,
      prev: shiftPeriod(periodType, current.periodKey, -1).periodKey,
      next: shiftPeriod(periodType, current.periodKey, 1).periodKey,
      stats,
      statsTrend,
      activeGoals: stats.activeGoals,
      goalReflections,
      review: review
        ? {
            wins: review.wins,
            improvements: review.improvements,
            nextFocus: review.nextFocus,
            goalReflections,
          }
        : null,
      pastReviews: pastReviews.map((r) => ({
        periodKey: r.periodKey,
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
    console.error("[review/period GET]", error);
    return NextResponse.json({ error: "加载周期复盘失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const periodType = (body.periodType || "month") as PeriodType;
  const periodKey = body.periodKey || getPeriodRange(periodType).periodKey;

  const range =
    body.start && body.end
      ? { start: body.start, end: body.end }
      : getPeriodRange(periodType, periodType === "month"
          ? new Date(Number(periodKey.split("-")[0]), Number(periodKey.split("-")[1]) - 1, 1)
          : periodType === "year"
            ? new Date(Number(periodKey), 0, 1)
            : new Date(Number(periodKey.split("-Q")[0]), (Number(periodKey.split("-Q")[1]) - 1) * 3, 1));

  const goalReflections = JSON.stringify(body.goalReflections ?? []);
  const stats = await buildPeriodStats(range.start, range.end);

  const review = await prisma.periodReview.upsert({
    where: { periodType_periodKey: { periodType, periodKey } },
    create: {
      periodType,
      periodKey,
      wins: body.wins || null,
      improvements: body.improvements || null,
      nextFocus: body.nextFocus || null,
      goalReflections,
      statsSnapshot: JSON.stringify(stats),
    },
    update: {
      wins: body.wins || null,
      improvements: body.improvements || null,
      nextFocus: body.nextFocus || null,
      goalReflections,
      statsSnapshot: JSON.stringify(stats),
    },
  });

  return NextResponse.json(review);
}
