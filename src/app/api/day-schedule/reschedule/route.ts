import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchMergedDaySchedule, rescheduleHabitOccurrence } from "@/lib/day-schedule";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { habitId, fromDate, toDate, startTime, endTime, scheduleBlockId } = body;

  if (!habitId || !fromDate || !toDate || !startTime || !endTime) {
    return NextResponse.json(
      { error: "缺少 habitId / fromDate / toDate / startTime / endTime" },
      { status: 400 }
    );
  }

  try {
    const block = await rescheduleHabitOccurrence(prisma, {
      habitId,
      fromDate,
      toDate,
      startTime,
      endTime,
      scheduleBlockId: scheduleBlockId ?? null,
    });
    const blocks = await fetchMergedDaySchedule(prisma, toDate);
    return NextResponse.json({ block, blocks });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "调整失败" },
      { status: 400 }
    );
  }
}
