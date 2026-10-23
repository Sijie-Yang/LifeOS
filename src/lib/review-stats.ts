import { format, addDays, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  getWeekRange,
  parseDaysOfWeek,
  getScheduledDatesInWeek,
} from "@/lib/reminders";
import { syncGoalProgress } from "@/lib/achievements";
import { brandingProjectFilter } from "@/lib/branding";
import {
  buildPeriodStats,
  getPeriodRange,
  shiftPeriod,
  type PeriodType,
} from "@/lib/period-review";
import { WEEKDAY_LABELS, CLOSED_PROJECT_STATUSES } from "@/lib/utils";

export type ReviewStatsSnapshot = {
  habitRate: number;
  habitCheckIns: number;
  habitExpected: number;
  avgProgress: number;
  contacted: number;
  contentPublished?: number;
  monthBalance?: number;
};

export type ReviewTrendPoint = ReviewStatsSnapshot & {
  key: string;
  label: string;
};

export function shiftWeek(weekStart: string, delta: -1 | 1): string {
  return format(addDays(parseISO(`${weekStart}T12:00:00`), delta * 7), "yyyy-MM-dd");
}

export function weekLabel(start: string, end: string): string {
  return `${format(parseISO(`${start}T12:00:00`), "M月d日")} – ${format(parseISO(`${end}T12:00:00`), "M月d日")}`;
}

export async function buildWeekStats(weekStart: string) {
  const { start, end } = getWeekRange(parseISO(`${weekStart}T12:00:00`));
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T23:59:59`);
  const today = format(new Date(), "yyyy-MM-dd");
  const effectiveEnd = end > today ? today : end;

  const [habits, weekCheckIns, projects, contactLogs, contentPublished, goals] =
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
      prisma.projectPlanStep.count({
        where: {
          done: true,
          isMilestone: true,
          doneDate: { gte: start, lte: end },
          project: brandingProjectFilter,
        },
      }),
      prisma.lifeGoal.findMany({
        where: { status: "ACTIVE" },
        include: {
          keyResults: true,
          projects: { select: { progress: true, status: true } },
        },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

  let totalExpected = 0;
  let totalDone = 0;

  const perHabit = habits
    .map((h) => {
      const days = parseDaysOfWeek(h.daysOfWeek);
      const scheduled = getScheduledDatesInWeek(days, start, effectiveEnd);
      const checkIns = weekCheckIns.filter((c) => c.habitId === h.id);
      const done = checkIns.filter((c) => scheduled.includes(c.date)).length;
      const expected = scheduled.length;
      totalExpected += expected;
      totalDone += done;
      const scheduleLabel = days
        .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
        .map((d) => WEEKDAY_LABELS[d === 0 ? 6 : d - 1])
        .join(" ");
      return {
        id: h.id,
        name: h.name,
        done,
        expected,
        rate: expected > 0 ? Math.round((done / expected) * 100) : 0,
        schedule: scheduleLabel,
      };
    })
    .filter((h) => h.expected > 0);

  const habitRate = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;
  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const avgProgress =
    activeProjects.length > 0
      ? Math.round(activeProjects.reduce((s, p) => s + p.progress, 0) / activeProjects.length)
      : 0;

  const contacted = new Set(contactLogs.map((l) => l.contactId)).size;

  const activeGoals = goals.map((g) => ({
    id: g.id,
    title: g.title,
    area: g.area,
    progress: syncGoalProgress(g.projects),
  }));

  return {
    start,
    end,
    weekLabel: weekLabel(start, end),
    stats: {
      habitRate,
      habitCheckIns: totalDone,
      habitExpected: totalExpected,
      activeProjects: activeProjects.length,
      avgProgress,
      contactedThisWeek: contacted,
      totalContacts: await prisma.contact.count(),
      contentPublished,
    },
    perHabit,
    activeGoals,
  };
}

export async function buildWeekStatsTrend(currentWeekStart: string, count = 12): Promise<ReviewTrendPoint[]> {
  const points: ReviewTrendPoint[] = [];
  let ws = currentWeekStart;
  for (let i = 0; i < count; i++) {
    const { start, end, stats } = await buildWeekStats(ws);
    points.unshift({
      key: ws,
      label: format(parseISO(`${start}T12:00:00`), "M/d"),
      habitRate: stats.habitRate,
      habitCheckIns: stats.habitCheckIns,
      habitExpected: stats.habitExpected,
      avgProgress: stats.avgProgress,
      contacted: stats.contactedThisWeek,
      contentPublished: stats.contentPublished,
    });
    ws = shiftWeek(ws, -1);
  }
  return points;
}

export async function buildPeriodStatsTrend(
  type: PeriodType,
  currentKey: string,
  count = 12
): Promise<ReviewTrendPoint[]> {
  const points: ReviewTrendPoint[] = [];
  let key = currentKey;
  for (let i = 0; i < count; i++) {
    const range =
      type === "month"
        ? getPeriodRange("month", new Date(Number(key.split("-")[0]), Number(key.split("-")[1]) - 1, 1))
        : type === "quarter"
          ? getPeriodRange("quarter", new Date(Number(key.split("-Q")[0]), (Number(key.split("-Q")[1]) - 1) * 3, 1))
          : getPeriodRange("year", new Date(Number(key), 0, 1));

    const stats = await buildPeriodStats(range.start, range.end);
    const shortLabel =
      type === "month"
        ? format(parseISO(`${range.start}T12:00:00`), "yy/M")
        : type === "quarter"
          ? key.replace("-", " ")
          : key;

    points.unshift({
      key,
      label: shortLabel,
      habitRate: stats.habitRate,
      habitCheckIns: stats.habitCheckIns,
      habitExpected: stats.habitExpected,
      avgProgress: stats.avgProgress,
      contacted: stats.contactedInPeriod,
      contentPublished: stats.contentPublished,
      monthBalance: stats.monthBalance,
    });
    key = shiftPeriod(type, key, -1).periodKey;
  }
  return points;
}

export function parseStatsSnapshot(raw: string): ReviewStatsSnapshot | null {
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return null;
    return {
      habitRate: s.habitRate ?? 0,
      habitCheckIns: s.habitCheckIns ?? 0,
      habitExpected: s.habitExpected ?? 0,
      avgProgress: s.avgProgress ?? 0,
      contacted: s.contactedInPeriod ?? s.contactedThisWeek ?? 0,
      contentPublished: s.contentPublished,
      monthBalance: s.monthBalance,
    };
  } catch {
    return null;
  }
}
