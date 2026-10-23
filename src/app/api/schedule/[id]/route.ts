import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

async function assertBlockEditable(blockId: string) {
  const block = await prisma.scheduleBlock.findUnique({
    where: { id: blockId },
    include: { habit: true },
  });
  if (!block) return { block: null, error: "时间块不存在" };
  if (block.habit?.scheduleMode === "weekly") {
    return {
      block,
      error: "该时间块由习惯自动同步，请在习惯设置中修改执行日或时间",
    };
  }
  return { block, error: null };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { block, error } = await assertBlockEditable(id);
  if (error) {
    return NextResponse.json({ error }, { status: block ? 400 : 404 });
  }

  const body = await request.json();
  if (body.habitId) {
    const habit = await prisma.habit.findUnique({ where: { id: body.habitId } });
    if (habit?.scheduleMode === "weekly") {
      return NextResponse.json(
        { error: "无法将时间块关联到周时间块模式的习惯" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.scheduleBlock.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.dayOfWeek !== undefined && { dayOfWeek: body.dayOfWeek }),
      ...(body.startTime !== undefined && { startTime: body.startTime }),
      ...(body.endTime !== undefined && { endTime: body.endTime }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.habitId !== undefined && { habitId: body.habitId || null }),
      ...(body.goalId !== undefined && { goalId: body.goalId || null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    include: { habit: true, goal: { select: { id: true, title: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const { block, error } = await assertBlockEditable(id);
  if (error) {
    return NextResponse.json({ error }, { status: block ? 400 : 404 });
  }
  await prisma.scheduleBlock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
