import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyInsights, buildWellnessTrend } from "@/lib/insights";
import { getWeekStart } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const weekStart = searchParams.get("weekStart") || getWeekStart();
  const includeWellness = searchParams.get("wellness") === "1";

  const insights = await buildWeeklyInsights(weekStart);
  const wellnessTrend = includeWellness ? await buildWellnessTrend(8) : undefined;

  return NextResponse.json({ weekStart, insights, wellnessTrend });
}
