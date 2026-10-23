import { addDays, format, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { CLOSED_PROJECT_STATUSES, toDateString } from "@/lib/utils";
import { mapStepsToDates } from "@/lib/project-plan";
import { effectiveTimerStatus } from "@/lib/event-timers";
import { timerDto } from "@/lib/event-timer-service";
import { pushConfigured, sendPush } from "@/lib/push";
import { planPushes, type PlannedPush } from "@/lib/push-plan";

/** 跑一次：收集今天的数据 → 算该推什么 → 没推过的推出去并记进 NudgeLog（key 前缀 push:） */
export async function runPushTick(now = new Date()): Promise<{ sent: string[]; skipped?: string }> {
  if (!pushConfigured()) return { sent: [], skipped: "没有配置 NTFY_TOPIC" };
  const today = toDateString(now);
  const hhmm = format(now, "HH:mm");

  const [timers, meetings, blocks, tasks, opps, log, projects] = await Promise.all([
    prisma.eventTimer.findMany({ where: { status: { in: ["running", "paused"] }, mode: "fixed" } }),
    prisma.meeting.findMany({ where: { meetingDate: today, status: { notIn: ["Cancelled", "Completed"] } }, select: { id: true, title: true, meetingTime: true } }),
    prisma.dayScheduleBlock.findMany({
      where: { date: today, skipped: false },
      select: { id: true, title: true, startTime: true, habitId: true, taskId: true },
    }),
    prisma.taskItem.findMany({
      where: { completed: false, cancelled: false, dueDate: { not: null, lte: today, gte: format(subDays(now, 30), "yyyy-MM-dd") } },
      select: { title: true, dueDate: true },
    }),
    prisma.opportunity.findMany({
      where: { status: { in: ["Watching", "Active"] }, deadline: { not: null, gte: format(subDays(now, 7), "yyyy-MM-dd"), lte: format(addDays(now, 3), "yyyy-MM-dd") } },
      select: { title: true, deadline: true },
    }),
    prisma.dailyLog.findUnique({ where: { date: today }, select: { closedAt: true } }),
    prisma.project.findMany({
      where: { planActive: true, status: { notIn: CLOSED_PROJECT_STATUSES }, archiveDate: null },
      include: { planSteps: true, category: { select: { color: true, name: true } } },
    }),
  ]);

  let stepsToday = 0;
  for (const p of projects) {
    const { byDate } = mapStepsToDates(p, p.planSteps, today);
    stepsToday += (byDate[today] ?? []).filter((s) => !s.done).length;
  }

  const planned = planPushes({
    today,
    now: hhmm,
    timersDone: timers
      .map(timerDto)
      .filter((t) => effectiveTimerStatus(t, +now) === "completed")
      .map((t) => ({ id: t.id, title: t.title, minutes: t.durationSeconds ? Math.round(t.durationSeconds / 60) : null })),
    meetings: meetings.map((m) => ({ id: m.id, title: m.title, time: m.meetingTime })),
    // 只挂习惯的时间块不推（习惯在今日页打卡）
    blocks: blocks.filter((b) => !(b.habitId && !b.taskId)).map((b) => ({ id: b.id, title: b.title, time: b.startTime })),
    tasksDue: tasks.map((t) => ({ title: t.title, dueDate: t.dueDate! })),
    deadlines: opps.map((o) => ({ title: o.title, deadline: o.deadline! })),
    stepsToday,
    closed: Boolean(log?.closedAt),
  });
  if (planned.length === 0) return { sent: [] };

  const sentBefore = await prisma.nudgeLog.findMany({
    where: { date: today, key: { in: planned.map((p) => `push:${p.key}`) } },
    select: { key: true },
  });
  const done = new Set(sentBefore.map((s) => s.key));
  const sent: string[] = [];
  for (const p of planned) {
    if (done.has(`push:${p.key}`)) continue;
    const { key, date, ...msg }: PlannedPush = p;
    const r = await sendPush({ ...msg, click: msg.click ?? `${process.env.LIFEOS_URL || "http://127.0.0.1:3000"}/stream` });
    if (!r.ok) continue;
    await prisma.nudgeLog.create({ data: { key: `push:${key}`, date } }).catch(() => null);
    sent.push(key);
  }
  return { sent };
}

/** 服务器启动时开一个每分钟的循环（重复调用只开一个） */
export function startPushLoop() {
  const g = globalThis as unknown as { __lifeosPushLoop?: ReturnType<typeof setInterval> };
  if (g.__lifeosPushLoop) return;
  const tick = () => runPushTick().catch((e) => console.error("[push]", e instanceof Error ? e.message : e));
  g.__lifeosPushLoop = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
}
