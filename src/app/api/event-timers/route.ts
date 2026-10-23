import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordEventTimer, startEventTimer, timerDto } from "@/lib/event-timer-service";
import { timerErrorResponse } from "@/lib/event-timer-response";

export async function GET(request: NextRequest) {
  try {
    const from = new Date(request.nextUrl.searchParams.get("from") ?? "");
    const to = new Date(request.nextUrl.searchParams.get("to") ?? "");
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || +to <= +from || +to - +from > 27 * 3600_000) return NextResponse.json({ error: "无效日期范围" }, { status: 400 });
    const rows = await prisma.eventTimer.findMany({
      where: { OR: [
        { status: { in: ["running", "paused"] } },
        { startedAt: { lt: to }, endedAt: { gte: from } },
      ] }, orderBy: { startedAt: "asc" },
    });
    // Running rows may be effectively completed while the browser was closed. Keep only this day or active timers.
    const { effectiveTimerStatus, timerSegments } = await import("@/lib/event-timers");
    const now = Date.now();
    const timers = rows.map(timerDto).filter((t) => {
      const status = effectiveTimerStatus(t, now);
      return status === "running" || status === "paused" || timerSegments(t, now).some((s) => Date.parse(s.start) < +to && Date.parse(s.end) >= +from);
    });
    return NextResponse.json({ timers, serverNow: now }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return timerErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // record: true → 补记已经发生的事（开始 + 结束），不开计时
    return NextResponse.json(body?.record === true ? await recordEventTimer(prisma, body) : await startEventTimer(prisma, body), { status: 201 });
  }
  catch (error) { return timerErrorResponse(error); }
}
