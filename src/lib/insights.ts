import { addDays, format, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getWeekRange, getWeekStart, isOverdue, GOAL_AREAS } from "@/lib/utils";
import { isHabitScheduledOnDateForHabit } from "@/lib/reminders";
import { parsePriorities } from "@/lib/weekly-plan";

export type InsightItem = {
  id: string;
  category: "habit" | "wellness" | "time" | "relationship" | "plan" | "urge" | "focus";
  severity: "info" | "warn" | "good";
  title: string;
  detail: string;
  href?: string;
};

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export async function buildWeeklyInsights(weekStart?: string): Promise<InsightItem[]> {
  const ws = weekStart || getWeekStart();
  const { start, end } = getWeekRange(parseISO(`${ws}T12:00:00`));
  const insights: InsightItem[] = [];

  const [habits, checkIns, dailyLogs, contacts, pomodoros, weeklyPlan, goals, urgeEvents] =
    await Promise.all([
      prisma.habit.findMany({ where: { isActive: true }, include: { project: { select: { goalId: true } } } }),
      prisma.habitCheckIn.findMany({
        where: { date: { gte: start, lte: end }, completed: true },
      }),
      prisma.dailyLog.findMany({
        where: { date: { gte: start, lte: end } },
        select: { date: true, energy: true, mood: true, sleepHours: true, closedAt: true },
      }),
      prisma.contact.findMany({ include: { category: true } }),
      prisma.pomodoroSession.findMany({
        where: { date: { gte: start, lte: end }, status: "completed" },
        include: { habit: { include: { project: { select: { goalId: true } } } } },
      }),
      prisma.weeklyPlan.findUnique({ where: { weekStart: ws } }),
      prisma.lifeGoal.findMany({ where: { status: "ACTIVE" }, select: { id: true, area: true, title: true } }),
      prisma.urgeEvent.findMany({
        where: { date: { gte: start, lte: end } },
        include: { category: { select: { name: true, isPrivate: true } } },
      }),
    ]);

  // Habit: completion by weekday
  const byDow = Array.from({ length: 7 }, () => ({ expected: 0, done: 0 }));
  for (let d = parseISO(`${start}T12:00:00`); d <= parseISO(`${end}T12:00:00`); d = addDays(d, 1)) {
    const dateStr = format(d, "yyyy-MM-dd");
    const dow = d.getDay();
    for (const h of habits) {
      if (!isHabitScheduledOnDateForHabit(h, dateStr)) continue;
      byDow[dow].expected += 1;
      if (checkIns.some((c) => c.habitId === h.id && c.date === dateStr)) byDow[dow].done += 1;
    }
  }
  const dowRates = byDow
    .map((x, i) => ({ dow: i, rate: x.expected > 0 ? Math.round((x.done / x.expected) * 100) : null }))
    .filter((x) => x.rate != null) as Array<{ dow: number; rate: number }>;
  if (dowRates.length > 0) {
    const worst = [...dowRates].sort((a, b) => a.rate - b.rate)[0];
    const best = [...dowRates].sort((a, b) => b.rate - a.rate)[0];
    if (worst.rate < 70) {
      insights.push({
        id: "habit-worst-dow",
        category: "habit",
        severity: "warn",
        title: `${WEEKDAY_NAMES[worst.dow]}习惯完成率最低`,
        detail: `仅 ${worst.rate}%，考虑调整该日安排或降低预期。`,
        href: "/habits",
      });
    }
    if (best.rate >= 80 && best.dow !== worst.dow) {
      insights.push({
        id: "habit-best-dow",
        category: "habit",
        severity: "good",
        title: `${WEEKDAY_NAMES[best.dow]}表现最好`,
        detail: `完成率 ${best.rate}%，可复盘该日的节奏是否可复制。`,
        href: "/habits",
      });
    }
  }

  // Habit: best/worst habit this week
  const habitStats = habits.map((h) => {
    let expected = 0;
    let done = 0;
    for (let d = parseISO(`${start}T12:00:00`); d <= parseISO(`${end}T12:00:00`); d = addDays(d, 1)) {
      const dateStr = format(d, "yyyy-MM-dd");
      if (!isHabitScheduledOnDateForHabit(h, dateStr)) continue;
      expected += 1;
      if (checkIns.some((c) => c.habitId === h.id && c.date === dateStr)) done += 1;
    }
    return { id: h.id, name: h.name, rate: expected > 0 ? Math.round((done / expected) * 100) : null, expected };
  }).filter((h) => h.expected > 0 && h.rate != null);

  if (habitStats.length >= 2) {
    const sorted = [...habitStats].sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0));
    const worstH = sorted[0];
    const bestH = sorted[sorted.length - 1];
    if (worstH.rate! < 60) {
      insights.push({
        id: "habit-worst",
        category: "habit",
        severity: "warn",
        title: `「${worstH.name}」本周最吃力`,
        detail: `完成率 ${worstH.rate}%，是否需要拆分或调整频率？`,
        href: "/habits",
      });
    }
    if (bestH.rate! >= 85) {
      insights.push({
        id: "habit-best",
        category: "habit",
        severity: "good",
        title: `「${bestH.name}」本周最稳`,
        detail: `完成率 ${bestH.rate}%，保持当前节奏。`,
        href: "/habits",
      });
    }
  }

  // Wellness: closed vs open days
  const withEnergy = dailyLogs.filter((l) => l.energy != null);
  if (withEnergy.length >= 3) {
    const closed = withEnergy.filter((l) => l.closedAt);
    const open = withEnergy.filter((l) => !l.closedAt);
    const avg = (arr: typeof withEnergy) =>
      arr.length ? arr.reduce((s, l) => s + (l.energy ?? 0), 0) / arr.length : 0;
    const closedAvg = avg(closed);
    const openAvg = avg(open);
    if (closed.length > 0 && open.length > 0 && closedAvg - openAvg >= 0.8) {
      insights.push({
        id: "wellness-close",
        category: "wellness",
        severity: "good",
        title: "关账日精力更高",
        detail: `已关账日平均精力 ${closedAvg.toFixed(1)}/5，未关账 ${openAvg.toFixed(1)}/5。坚持晚间收尾。`,
        href: "/daily",
      });
    }
    const lowEnergy = withEnergy.filter((l) => (l.energy ?? 5) <= 2);
    if (lowEnergy.length >= 2) {
      insights.push({
        id: "wellness-low",
        category: "wellness",
        severity: "warn",
        title: `本周 ${lowEnergy.length} 天低精力`,
        detail: "考虑减少低精力日的必做数量，或增加睡眠/恢复时间。",
        href: "/daily",
      });
    }
  }

  // Time alignment: pomodoro minutes by goal area vs weekly plan
  const areaMinutes: Record<string, number> = {};
  for (const p of pomodoros) {
    const goalId = p.habit.project?.goalId;
    const goal = goals.find((g) => g.id === goalId);
    const area = goal?.area || "other";
    areaMinutes[area] = (areaMinutes[area] || 0) + (p.actualMinutes ?? p.plannedMinutes);
  }
  const totalMin = Object.values(areaMinutes).reduce((a, b) => a + b, 0);
  if (totalMin >= 60) {
    const topArea = Object.entries(areaMinutes).sort((a, b) => b[1] - a[1])[0];
    const areaLabel = GOAL_AREAS[topArea[0]]?.label || topArea[0];
    insights.push({
      id: "time-top-area",
      category: "time",
      severity: "info",
      title: `专注时间集中在「${areaLabel}」`,
      detail: `本周番茄 ${totalMin} 分钟，其中 ${areaLabel} 占 ${Math.round((topArea[1] / totalMin) * 100)}%。`,
      href: "/habits",
    });

    const priorities = parsePriorities(weeklyPlan?.priorities);
    const planGoalIds = new Set(priorities.map((p) => p.goalId).filter(Boolean));
    if (planGoalIds.size > 0) {
      const planAreas = new Set(
        [...planGoalIds].map((id) => goals.find((g) => g.id === id)?.area).filter(Boolean)
      );
      const topAreaKey = topArea[0];
      if (planAreas.size > 0 && !planAreas.has(topAreaKey)) {
        insights.push({
          id: "time-mismatch",
          category: "time",
          severity: "warn",
          title: "专注方向与本周优先级不完全一致",
          detail: `番茄主要花在 ${areaLabel}，但本周优先级关联其他领域。`,
          href: "/plan/week",
        });
      }
    }
  }

  // Relationships: top 3 to contact
  const overdue = contacts
    .filter((c) => isOverdue(c.lastContactAt, c.contactFrequencyDays))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 3);
  if (overdue.length > 0) {
    insights.push({
      id: "rel-overdue",
      category: "relationship",
      severity: "warn",
      title: "本周最该联系的人",
      detail: overdue.map((c) => c.name).join("、") + " 已超过联系频率。",
      href: "/contacts",
    });
  }

  // Weekly plan completion
  const priorities = parsePriorities(weeklyPlan?.priorities);
  if (priorities.length > 0) {
    const done = priorities.filter((p) => p.completed).length;
    insights.push({
      id: "plan-progress",
      category: "plan",
      severity: done === priorities.length ? "good" : done === 0 ? "warn" : "info",
      title: `本周优先级 ${done}/${priorities.length} 完成`,
      detail:
        done === priorities.length
          ? "本周计划全部达成，复盘时可写进「做得好」。"
          : priorities.filter((p) => !p.completed).map((p) => p.title).join("、") + " 尚未标记完成。",
      href: "/plan/week",
    });
  } else {
    insights.push({
      id: "plan-missing",
      category: "plan",
      severity: "info",
      title: "尚未设定本周优先级",
      detail: "花 2 分钟选 1–3 条，让每日行动对齐长期目标。",
      href: "/plan/week",
    });
  }

  // Urge: top trigger & energy correlation
  if (urgeEvents.length >= 2) {
    const triggerCounts: Record<string, number> = {};
    for (const e of urgeEvents) {
      if (e.trigger) triggerCounts[e.trigger] = (triggerCounts[e.trigger] || 0) + 1;
    }
    const topTrigger = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];
    if (topTrigger) {
      insights.push({
        id: "urge-trigger",
        category: "urge",
        severity: "info",
        title: `冲动最常因「${topTrigger[0]}」触发`,
        detail: `本周 ${topTrigger[1]} 次。识别触发场景是改变的第一步。`,
        href: "/urges",
      });
    }
    const gaveInDays = new Set(urgeEvents.filter((e) => e.outcome === "gave_in").map((e) => e.date));
    const nextDayEnergy: number[] = [];
    for (const d of gaveInDays) {
      const next = format(addDays(parseISO(`${d}T12:00:00`), 1), "yyyy-MM-dd");
      const log = dailyLogs.find((l) => l.date === next);
      if (log?.energy != null) nextDayEnergy.push(log.energy);
    }
    const normalEnergy = dailyLogs.filter((l) => l.energy != null && !gaveInDays.has(l.date)).map((l) => l.energy!);
    if (nextDayEnergy.length >= 2 && normalEnergy.length >= 2) {
      const avgGaveIn = nextDayEnergy.reduce((a, b) => a + b, 0) / nextDayEnergy.length;
      const avgNormal = normalEnergy.reduce((a, b) => a + b, 0) / normalEnergy.length;
      if (avgNormal - avgGaveIn >= 0.5) {
        insights.push({
          id: "urge-energy",
          category: "urge",
          severity: "warn",
          title: "满足冲动后，次日精力更低",
          detail: `冲动满足日次日平均精力 ${avgGaveIn.toFixed(1)}/5，其他日 ${avgNormal.toFixed(1)}/5。`,
          href: "/urges",
        });
      }
    }
  }

  // Focus: distraction trend & low-energy completion
  const completedPomos = pomodoros.filter((p) => p.status === "completed");
  if (completedPomos.length >= 3) {
    const avgDist = completedPomos.reduce((s, p) => s + (p.distractions ?? 0), 0) / completedPomos.length;
    if (avgDist >= 1) {
      insights.push({
        id: "focus-distraction",
        category: "focus",
        severity: avgDist >= 2 ? "warn" : "info",
        title: `每次专注平均分心 ${avgDist.toFixed(1)} 次`,
        detail: "试试全屏专注模式，分心时点 +1 记录觉察。",
        href: "/daily",
      });
    }
    const lowEnergy = completedPomos.filter((p) => (p.preEnergy ?? 5) <= 2);
    if (lowEnergy.length >= 2) {
      const rate = Math.round((lowEnergy.length / completedPomos.length) * 100);
      insights.push({
        id: "focus-low-energy",
        category: "focus",
        severity: "info",
        title: `低精力日占了 ${rate}% 的专注`,
        detail: "低精力时试试 15 分钟微专注，不必硬扛 25 分钟。",
        href: "/daily",
      });
    }
  }

  // Habit gap: planned vs actual (minimum counts as partial)
  let weekExpected = 0;
  let weekDone = 0;
  let weekMinimum = 0;
  for (let d = parseISO(`${start}T12:00:00`); d <= parseISO(`${end}T12:00:00`); d = addDays(d, 1)) {
    const dateStr = format(d, "yyyy-MM-dd");
    for (const h of habits) {
      if (!isHabitScheduledOnDateForHabit(h, dateStr)) continue;
      weekExpected += 1;
      const ci = checkIns.find((c) => c.habitId === h.id && c.date === dateStr);
      if (ci) {
        if ((ci as { level?: string }).level === "minimum") weekMinimum += 1;
        else weekDone += 1;
      }
    }
  }
  if (weekExpected > 0) {
    const gap = weekExpected - weekDone - weekMinimum;
    if (gap > 0) {
      insights.push({
        id: "habit-gap",
        category: "habit",
        severity: gap >= weekExpected * 0.4 ? "warn" : "info",
        title: `习惯缺口：计划 ${weekExpected} 次 / 完成 ${weekDone} 次`,
        detail:
          weekMinimum > 0
            ? `另有 ${weekMinimum} 次最小版本。缺口 ${gap} 次，考虑降低预期或设最小版本。`
            : `缺口 ${gap} 次。给吃力的习惯设「最小版本」可提高执行率。`,
        href: "/habits",
      });
    }
  }

  return insights.slice(0, 10);
}

export async function buildWellnessTrend(weeks = 8) {
  const points: Array<{
    weekStart: string;
    label: string;
    avgEnergy: number | null;
    avgMood: number | null;
    avgSleep: number | null;
    logDays: number;
  }> = [];

  let ws = getWeekStart();
  for (let i = 0; i < weeks; i++) {
    const { start, end } = getWeekRange(parseISO(`${ws}T12:00:00`));
    const logs = await prisma.dailyLog.findMany({
      where: { date: { gte: start, lte: end } },
      select: { energy: true, mood: true, sleepHours: true },
    });
    const withData = logs.filter((l) => l.energy != null || l.mood != null || l.sleepHours != null);
    const avg = (key: "energy" | "mood" | "sleepHours") => {
      const vals = withData.map((l) => l[key]).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    points.unshift({
      weekStart: ws,
      label: format(parseISO(`${start}T12:00:00`), "M/d"),
      avgEnergy: avg("energy"),
      avgMood: avg("mood"),
      avgSleep: avg("sleepHours"),
      logDays: withData.length,
    });
    ws = format(addDays(parseISO(`${ws}T12:00:00`), -7), "yyyy-MM-dd");
  }

  return points;
}
