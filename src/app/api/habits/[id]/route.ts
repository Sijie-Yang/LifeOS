import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isHabitPowerValue } from "@/lib/life-powers";
import { applyHabitScheduleSync, clearHabitScheduleBlocks, inferScheduleMode } from "@/lib/habit-schedule-sync";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.habit.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "习惯不存在" }, { status: 404 });
  }

  const scheduleMode = inferScheduleMode({
    scheduleMode: body.scheduleMode ?? existing.scheduleMode,
    startTime: body.startTime !== undefined ? body.startTime || null : existing.startTime,
    endTime: body.endTime !== undefined ? body.endTime || null : existing.endTime,
    frequency: body.frequency ?? existing.frequency,
  });

  const habit = await prisma.habit.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.projectId !== undefined && { projectId: body.projectId || null }),
      ...(body.frequency !== undefined && { frequency: body.frequency }),
      scheduleMode,
      ...(body.daysOfWeek !== undefined && { daysOfWeek: JSON.stringify(body.daysOfWeek) }),
      ...(body.monthDays !== undefined && { monthDays: JSON.stringify(body.monthDays) }),
      ...(body.startTime !== undefined && { startTime: body.startTime || null }),
      ...(body.endTime !== undefined && { endTime: body.endTime || null }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      ...(body.minimumVersion !== undefined && { minimumVersion: body.minimumVersion?.trim() || null }),
      ...(body.cue !== undefined && { cue: body.cue?.trim() || null }),
      ...(body.power !== undefined && { power: isHabitPowerValue(body.power) ? body.power : null }),
    },
    include: { project: true },
  });

  const scheduleFieldsChanged =
    body.scheduleMode !== undefined ||
    body.daysOfWeek !== undefined ||
    body.monthDays !== undefined ||
    body.startTime !== undefined ||
    body.endTime !== undefined ||
    body.name !== undefined ||
    body.color !== undefined ||
    body.description !== undefined;

  if (scheduleFieldsChanged) {
    await applyHabitScheduleSync(prisma, habit.id, habit.scheduleMode);
  }

  const synced = await prisma.habit.findUnique({
    where: { id: habit.id },
    include: { project: true },
  });
  return NextResponse.json(synced);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await clearHabitScheduleBlocks(prisma, id);
  await prisma.habit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
