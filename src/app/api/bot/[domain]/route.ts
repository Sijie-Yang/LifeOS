import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { toDateString } from "@/lib/utils";
import { getWeekStart } from "@/lib/reminders";
import { parsePriorities } from "@/lib/weekly-plan";
import { parseMustDo } from "@/lib/accountability";
import { parseRecordExtras, parseRecordNotes } from "@/lib/day-record";
import { collectTomorrow } from "@/lib/bot-report";
import { loadReports } from "@/lib/bot-report-files";

/**
 * 只读快照，供 bot 了解 LifeOS。所有 bot 都能读所有 domain（domain 只是关注点，不是权限）。
 * GET /api/bot/research | contacts | jobs | daily
 * 写库统一走 POST /api/plan/align（带 source）。
 */
type Params = { params: Promise<{ domain: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { domain } = await params;
  const q = request.nextUrl.searchParams;
  switch (domain) {
    case "research": {
      const category = q.get("category") ?? "Research";
      const projects = await prisma.project.findMany({
        where: { category: { name: category }, ...(q.get("all") ? {} : { archiveDate: null }) },
        select: {
          id: true, name: true, status: true, priority: true, progress: true, tags: true, power: true,
          planActive: true, planWorkdays: true, pinned: true, targetDate: true, wishFinishTime: true, updatedAt: true,
          planSteps: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, done: true, doneDate: true, detail: true } },
        },
        orderBy: [{ planActive: "desc" }, { pinned: "desc" }, { sortOrder: "asc" }],
      });
      return NextResponse.json({ domain, category, count: projects.length, projects });
    }
    case "contacts": {
      const contacts = await prisma.contact.findMany({
        select: {
          id: true, name: true, email: true, phone: true, company: true, position: true, institution: true, city: true,
          tags: true, importance: true, contactFrequencyDays: true, lastContactAt: true, responseLevel: true, notes: true,
          category: { select: { name: true } },
          logs: { orderBy: { contactedAt: "desc" }, take: Number(q.get("logs") ?? 3), select: { type: true, content: true, contactedAt: true } },
        },
        orderBy: [{ importance: "desc" }, { name: "asc" }],
      });
      const categories = await prisma.contactCategory.findMany({ select: { name: true } });
      return NextResponse.json({ domain, count: contacts.length, categories: categories.map((c) => c.name), contacts });
    }
    case "jobs": {
      const lane = q.get("lane");
      const opportunities = await prisma.opportunity.findMany({
        where: lane ? { lane } : {},
        select: {
          id: true, title: true, lane: true, category: true, status: true, priority: true, deadline: true,
          source: true, nextAction: true, notes: true, projectId: true, updatedAt: true,
        },
        orderBy: [{ deadline: "asc" }],
      });
      return NextResponse.json({ domain, count: opportunities.length, opportunities });
    }
    case "daily": {
      // 早上计划到晚上关账要的全部：今日步骤 / 习惯（align 上下文）+ 日计划 + 日志状态 + 任务 + 周计划 / 周复盘 + 昨晚日报的「明天」
      const date = q.get("date") && /^\d{4}-\d{2}-\d{2}$/.test(q.get("date")!) ? q.get("date")! : toDateString();
      const yesterday = format(subDays(new Date(`${date}T12:00:00`), 1), "yyyy-MM-dd");
      const weekStart = getWeekStart(new Date(`${date}T12:00:00`));
      const alignRes = await fetch(new URL(`/api/plan/align?mode=${q.get("mode") ?? "daily"}&date=${date}`, request.url));
      const align = alignRes.ok ? ((await alignRes.json()) as { context: unknown }).context : null;
      const [plan, log, tasks, weekPlan, weekReview, today, prev] = await Promise.all([
        prisma.dailyPlan.findUnique({ where: { date } }),
        prisma.dailyLog.findUnique({ where: { date } }),
        prisma.taskItem.findMany({
          where: {
            cancelled: false,
            OR: [{ completed: false }, { completedAt: { gte: new Date(`${date}T00:00:00`) } }],
          },
          select: { id: true, title: true, completed: true, dueDate: true, scheduledDate: true, priority: true, projectId: true, source: true },
          orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
          take: 50,
        }),
        prisma.weeklyPlan.findUnique({ where: { weekStart } }),
        prisma.weeklyReview.findUnique({ where: { weekStart } }),
        loadReports(date),
        loadReports(yesterday),
      ]);
      return NextResponse.json({
        domain,
        date,
        dayPlan: { intention: plan?.intention ?? null, priorities: parsePriorities(plan?.priorities) },
        dayLog: log
          ? {
              closed: Boolean(log.closedAt),
              closedAt: log.closedAt,
              closeNote: log.closeNote,
              reflection: log.reflection,
              mustDo: parseMustDo(log.mustDo),
              planScore: log.planScore,
              planScoreNote: log.planScoreNote,
              recordNotes: parseRecordNotes(log.recordNotes),
              recordExtras: parseRecordExtras(log.recordExtras),
              wellness: {
                wakeTime: log.wakeTime, sleepHours: log.sleepHours, plannedSleepTime: log.plannedSleepTime, sleepTime: log.sleepTime,
                energyMorning: log.energyMorning, drainMorning: log.drainMorning, urgeMorning: log.urgeMorning,
                energyEvening: log.energyEvening, drainEvening: log.drainEvening,
                weightKg: log.weightKg, exerciseMinutes: log.exerciseMinutes, exerciseStartTime: log.exerciseStartTime,
              },
            }
          : { closed: false, note: "今天还没有 DailyLog（第一次写入时自动建）" },
        align,
        tasks,
        week: {
          weekStart,
          plan: weekPlan ? { intention: weekPlan.intention, priorities: parsePriorities(weekPlan.priorities) } : null,
          review: weekReview ? { wins: weekReview.wins, improvements: weekReview.improvements, nextFocus: weekReview.nextFocus } : null,
        },
        reportsToday: today.reports.map((r) => r.bot),
        yesterdayTomorrow: collectTomorrow(prev.reports),
      });
    }
    default:
      return NextResponse.json({ error: "domain 需为 research | contacts | jobs | daily" }, { status: 404 });
  }
}
