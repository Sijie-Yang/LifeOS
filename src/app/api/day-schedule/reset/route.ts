import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetHabitOccurrence } from "@/lib/day-schedule";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, habitId, scheduleBlockId } = body;

  if (!date || !habitId) {
    return NextResponse.json({ error: "缺少 date / habitId" }, { status: 400 });
  }

  try {
    await resetHabitOccurrence(prisma, date, habitId, scheduleBlockId ?? null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "重置失败" },
      { status: 400 }
    );
  }
}
