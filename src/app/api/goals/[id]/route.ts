import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncGoalProgress } from "@/lib/achievements";
import { fetchGoalCommandCenter } from "@/lib/goal-command-center";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const goal = await fetchGoalCommandCenter(id);
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(goal);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  await prisma.lifeGoal.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.area !== undefined && { area: body.area }),
      ...(body.horizon !== undefined && { horizon: body.horizon }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.progress !== undefined && { progress: body.progress }),
      ...(body.targetDate !== undefined && {
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
      }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.budgetAmount !== undefined && {
        budgetAmount: body.budgetAmount != null ? Number(body.budgetAmount) : null,
      }),
      ...(body.budgetCurrency !== undefined && {
        budgetCurrency: body.budgetCurrency || null,
      }),
      ...(body.whyItMatters !== undefined && { whyItMatters: body.whyItMatters || null }),
      ...(body.resourceNote !== undefined && { resourceNote: body.resourceNote || null }),
    },
  });

  const goal = await fetchGoalCommandCenter(id);
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...goal,
    progress: syncGoalProgress(goal.projects),
  });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.lifeGoal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
