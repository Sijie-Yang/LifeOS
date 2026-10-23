import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function assertNotWeeklyHabitBlock(habitId: string | null | undefined) {
  if (!habitId) return null;
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (habit?.scheduleMode === "weekly") {
    return "该习惯使用周时间块模式，请在习惯设置中修改时间，无法单独编辑时间表";
  }
  return null;
}

export async function GET() {
  const blocks = await prisma.scheduleBlock.findMany({
    where: { isActive: true },
    include: { habit: true, goal: { select: { id: true, title: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json(blocks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const err = await assertNotWeeklyHabitBlock(body.habitId);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const block = await prisma.scheduleBlock.create({
    data: {
      title: body.title,
      description: body.description || null,
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
      color: body.color || "#6366f1",
      habitId: body.habitId || null,
      goalId: body.goalId || null,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
    include: { habit: true, goal: { select: { id: true, title: true } } },
  });
  return NextResponse.json(block, { status: 201 });
}
