import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { CLOSED_PROJECT_STATUSES } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { brandingProjectFilter } from "@/lib/branding";
import { getWeekRange, parseDaysOfWeek, getScheduledDatesInWeek } from "@/lib/reminders";
import { syncGoalProgress } from "@/lib/achievements";
import { getFinanceContext } from "@/lib/finance-service";
import { computeMonthFlows, toBase } from "@/lib/finance";

export type PeriodType = "month" | "quarter" | "year";

export function getPeriodRange(type: PeriodType, ref = new Date()) {
  if (type === "month") {
    const start = startOfMonth(ref);
    const end = endOfMonth(ref);
    return {
      periodKey: format(start, "yyyy-MM"),
      periodLabel: format(start, "yyyy年M月"),
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  }
  if (type === "quarter") {
    const start = startOfQuarter(ref);
    const end = endOfQuarter(ref);
    const q = Math.floor(start.getMonth() / 3) + 1;
    return {
      periodKey: `${format(start, "yyyy")}-Q${q}`,
      periodLabel: `${format(start, "yyyy")}年 Q${q}`,
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    };
  }
  const start = startOfYear(ref);
  const end = endOfYear(ref);
  return {
    periodKey: format(start, "yyyy"),
    periodLabel: `${format(start, "yyyy")}年`,
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}

export function parseGoalReflections(raw: string): Array<{ goalId: string; note: string }> {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function buildPeriodStats(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59`);

  const [habits, checkIns, projects, contactLogs, goals, contentPublished, transactions] =
    await Promise.all([
      prisma.habit.findMany({ where: { isActive: true } }),
      prisma.habitCheckIn.findMany({
        where: { date: { gte: start, lte: end }, completed: true },
      }),
      prisma.project.findMany({ where: { status: { notIn: CLOSED_PROJECT_STATUSES } } }),
      prisma.contactLog.findMany({
        where: { contactedAt: { gte: startDate, lte: endDate } },
        select: { contactId: true },
      }),
      prisma.lifeGoal.findMany({
        where: { status: "ACTIVE" },
        include: { keyResults: true, projects: { select: { progress: true, status: true } } },
      }),
      prisma.projectPlanStep.count({
        where: {
          done: true,
          isMilestone: true,
          doneDate: { gte: start, lte: end },
          project: brandingProjectFilter,
        },
      }),
      prisma.transaction.findMany({
        where: { date: { gte: start, lte: end } },
        include: { account: true },
      }),
    ]);

  let totalExpected = 0;
  let totalDone = 0;

  // Walk each week overlapping the period
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    const { start: ws, end: we } = getWeekRange(cursor);
    if (we < start || ws > end) {
      cursor.setDate(cursor.getDate() + 7);
      continue;
    }
    const effectiveEnd = we > end ? end : we;
    for (const h of habits) {
      const days = parseDaysOfWeek(h.daysOfWeek);
      const scheduled = getScheduledDatesInWeek(days, ws, effectiveEnd).filter(
        (d) => d >= start && d <= end
      );
      const done = checkIns.filter(
        (c) => c.habitId === h.id && scheduled.includes(c.date)
      ).length;
      totalExpected += scheduled.length;
      totalDone += done;
    }
    cursor.setDate(cursor.getDate() + 7);
  }

  const habitRate = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;
  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const avgProgress =
    activeProjects.length > 0
      ? Math.round(activeProjects.reduce((s, p) => s + p.progress, 0) / activeProjects.length)
      : 0;

  const contactedInPeriod = new Set(contactLogs.map((l) => l.contactId)).size;

  const activeGoals = goals.map((g) => ({
    id: g.id,
    title: g.title,
    area: g.area,
    progress: syncGoalProgress(g.projects),
  }));

  let monthIncome = 0;
  let monthExpense = 0;
  try {
    const { settings, rateMap } = await getFinanceContext();
    const flows = computeMonthFlows(transactions, settings.baseCurrency, rateMap);
    monthIncome = flows.monthIncome;
    monthExpense = flows.monthExpense;
  } catch {
    /* optional */
  }

  return {
    habitRate,
    habitCheckIns: totalDone,
    habitExpected: totalExpected,
    activeProjects: activeProjects.length,
    avgProgress,
    contactedInPeriod,
    totalContacts: await prisma.contact.count(),
    contentPublished,
    monthIncome,
    monthExpense,
    monthBalance: monthIncome - monthExpense,
    activeGoals,
  };
}

export function shiftPeriod(type: PeriodType, periodKey: string, delta: -1 | 1) {
  if (type === "month") {
    const [y, m] = periodKey.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return getPeriodRange("month", d);
  }
  if (type === "quarter") {
    const [yStr, qStr] = periodKey.split("-Q");
    const d = new Date(Number(yStr), (Number(qStr) - 1) * 3 + delta * 3, 1);
    return getPeriodRange("quarter", d);
  }
  const y = Number(periodKey) + delta;
  return getPeriodRange("year", new Date(y, 0, 1));
}
