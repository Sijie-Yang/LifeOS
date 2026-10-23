import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/utils";
import { isHabitCheckInAllowedOnDate } from "@/lib/reminders";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const date = body.date || toDateString();

  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit) {
    return NextResponse.json({ error: "习惯不存在" }, { status: 404 });
  }
  if (!habit.isActive) {
    return NextResponse.json({ error: "该习惯已暂停" }, { status: 400 });
  }
  if (date > toDateString()) {
    return NextResponse.json({ error: "不能为未来日期打卡" }, { status: 400 });
  }

  const dayBlock = await prisma.dayScheduleBlock.findFirst({
    where: { habitId: id, date },
    select: { skipped: true },
  });

  if (!isHabitCheckInAllowedOnDate(habit, date, dayBlock)) {
    return NextResponse.json({ error: "该日期不是此习惯的执行日，无法打卡" }, { status: 400 });
  }

  const checkIn = await prisma.habitCheckIn.upsert({
    where: { habitId_date: { habitId: id, date } },
    create: {
      habitId: id,
      date,
      completed: body.completed ?? true,
      level: body.level || (body.completed === false ? "skip" : "full"),
      note: body.note || null,
    },
    update: {
      completed: body.completed ?? true,
      level: body.level || (body.completed === false ? "skip" : "full"),
      note: body.note || null,
      completedAt: new Date(),
    },
  });

  return NextResponse.json(checkIn);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const date = request.nextUrl.searchParams.get("date") || toDateString();
  await prisma.habitCheckIn.deleteMany({ where: { habitId: id, date } });
  return NextResponse.json({ ok: true });
}
