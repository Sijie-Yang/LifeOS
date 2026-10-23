import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchMergedDaySchedule,
  skipHabitOccurrence,
  unskipHabitOccurrence,
} from "@/lib/day-schedule";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.date || (!body.scheduleBlockId && !body.habitId)) {
    return NextResponse.json(
      { error: "缺少 date，以及 scheduleBlockId 或 habitId" },
      { status: 400 }
    );
  }

  try {
    const params = {
      date: body.date,
      habitId: body.habitId ?? null,
      scheduleBlockId: body.scheduleBlockId ?? null,
    };
    if (body.undo === true || body.action === "unskip") {
      await unskipHabitOccurrence(prisma, params);
    } else {
      await skipHabitOccurrence(prisma, params);
    }
    const blocks = await fetchMergedDaySchedule(prisma, body.date);
    return NextResponse.json({ ok: true, blocks });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "操作失败" },
      { status: 404 }
    );
  }
}
