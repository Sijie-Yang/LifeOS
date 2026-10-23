import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { fetchCalendarWeek, getWeekStartMonday } from "@/lib/calendar-week";

export async function GET(request: NextRequest) {
  const startParam = request.nextUrl.searchParams.get("start");
  const weekStart = getWeekStartMonday(startParam || format(new Date(), "yyyy-MM-dd"));
  const data = await fetchCalendarWeek(prisma, weekStart);
  return NextResponse.json(data);
}
