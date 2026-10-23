import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchGoalsWithCertainty } from "@/lib/goal-command-center";

export async function GET() {
  const goals = await fetchGoalsWithCertainty();
  return NextResponse.json(goals);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const maxOrder = await prisma.lifeGoal.aggregate({ _max: { sortOrder: true } });

  const goal = await prisma.lifeGoal.create({
    data: {
      title: body.title,
      description: body.description || null,
      area: body.area || "career",
      horizon: body.horizon || "1y",
      status: body.status || "ACTIVE",
      progress: body.progress ?? 0,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      budgetAmount: body.budgetAmount != null ? Number(body.budgetAmount) : null,
      budgetCurrency: body.budgetCurrency || null,
      whyItMatters: body.whyItMatters || null,
      resourceNote: body.resourceNote || null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    include: {
      keyResults: true,
      projects: { select: { id: true, name: true, progress: true, status: true } },
    },
  });

  return NextResponse.json(goal, { status: 201 });
}
