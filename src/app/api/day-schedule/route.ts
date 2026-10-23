import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blockInclude, fetchMergedDaySchedule, materializeHabitDayBlock, materializeHabitDayOverride } from "@/lib/day-schedule";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "缺少 date 参数" }, { status: 400 });
  }

  const blocks = await fetchMergedDaySchedule(prisma, date);
  return NextResponse.json(blocks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.scheduleBlockId) {
    if (!body.date || !body.startTime || !body.endTime) {
      return NextResponse.json({ error: "缺少 date / startTime / endTime" }, { status: 400 });
    }
    try {
      const block = await materializeHabitDayBlock(
        prisma,
        body.date,
        body.scheduleBlockId,
        body.startTime,
        body.endTime
      );
      return NextResponse.json(block, { status: 201 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "创建失败" },
        { status: 404 }
      );
    }
  }

  if (body.habitId) {
    if (!body.date || !body.startTime || !body.endTime) {
      return NextResponse.json({ error: "缺少 date / startTime / endTime" }, { status: 400 });
    }
    try {
      const block = await materializeHabitDayOverride(
        prisma,
        body.date,
        body.habitId,
        body.startTime,
        body.endTime
      );
      return NextResponse.json(block, { status: 201 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "创建失败" },
        { status: 404 }
      );
    }
  }

  if (!body.date || !body.title || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
  }

  const block = await prisma.dayScheduleBlock.create({
    data: {
      date: body.date,
      title: body.title,
      description: body.description || null,
      startTime: body.startTime,
      endTime: body.endTime,
      color: body.color || "#6366f1",
      taskId: body.taskId || null,
      goalId: body.goalId || null,
      sortOrder: body.sortOrder ?? 0,
    },
    include: blockInclude,
  });

  const blocks = await fetchMergedDaySchedule(prisma, body.date);
  const created = blocks.find((b) => b.id === block.id);
  return NextResponse.json(created ?? block, { status: 201 });
}
