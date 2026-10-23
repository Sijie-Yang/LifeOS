import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blockInclude, fetchMergedDaySchedule } from "@/lib/day-schedule";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await prisma.dayScheduleBlock.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "时间块不存在" }, { status: 404 });
  }

  const body = await request.json();
  await prisma.dayScheduleBlock.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.startTime !== undefined && { startTime: body.startTime }),
      ...(body.endTime !== undefined && { endTime: body.endTime }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.taskId !== undefined && { taskId: body.taskId || null }),
      ...(body.goalId !== undefined && { goalId: body.goalId || null }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
  });

  const blocks = await fetchMergedDaySchedule(prisma, existing.date);
  const updated = blocks.find((b) => b.id === id);
  return NextResponse.json(updated ?? { ok: true });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await prisma.dayScheduleBlock.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "时间块不存在" }, { status: 404 });
  }
  const date = existing.date;
  await prisma.dayScheduleBlock.delete({ where: { id } });
  const blocks = await fetchMergedDaySchedule(prisma, date);
  return NextResponse.json({ ok: true, blocks });
}
