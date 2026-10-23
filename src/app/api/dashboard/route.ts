import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERSONAL_BRANDING_NAME, brandingProjectFilter } from "@/lib/branding";
import { isOverdue, toDateString, CLOSED_PROJECT_STATUSES } from "@/lib/utils";
import { isHabitScheduledOnDateForHabit } from "@/lib/reminders";
import { listAchievements, scheduleAchievementSync, syncGoalProgress } from "@/lib/achievements";
import { getFinanceDashboardSummary } from "@/lib/finance-service";
import { subDays, format } from "date-fns";
import { computeHabitStreak } from "@/lib/habit-streak";
import {
  isEveningReminderHour,
  isMustDoDone,
  isStaleGoal,
  parseMustDo,
} from "@/lib/accountability";

export async function GET() {
  const today = toDateString();
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const [contacts, projects, habits, todayCheckIns, recentNotes, scheduleBlocks, dayScheduleBlocks] =
    await Promise.all([
      prisma.contact.findMany({ include: { category: true } }),
      prisma.project.findMany({ where: { status: { notIn: CLOSED_PROJECT_STATUSES } } }),
      prisma.habit.findMany({ where: { isActive: true } }),
      prisma.habitCheckIn.findMany({ where: { date: today, completed: true } }),
      prisma.note.findMany({ orderBy: { updatedAt: "desc" }, take: 5, include: { project: true } }),
      prisma.scheduleBlock.findMany({
        where: { isActive: true },
        include: { habit: true },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      prisma.dayScheduleBlock.findMany({
        where: { date: today },
        orderBy: { startTime: "asc" },
      }),
    ]);

  const overdueContacts = contacts.filter((c) =>
    isOverdue(c.lastContactAt, c.contactFrequencyDays)
  );

  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const planningProjects = projects.filter((p) => p.status === "PLANNING");

  const weekCheckIns = await prisma.habitCheckIn.findMany({
    where: { date: { gte: weekAgo }, completed: true },
  });

  const todayPomodoros = await prisma.pomodoroSession.findMany({
    where: { date: today, status: "completed" },
    select: { actualMinutes: true },
  });
  const todayPomodoroCount = todayPomodoros.length;
  const todayFocusMinutes = todayPomodoros.reduce((s, p) => s + (p.actualMinutes ?? 0), 0);

  const streakHabits = habits.slice(0, 6);
  const streakCheckIns =
    streakHabits.length > 0
      ? await prisma.habitCheckIn.findMany({
          where: { habitId: { in: streakHabits.map((h) => h.id) }, completed: true },
          select: { habitId: true, date: true },
        })
      : [];
  const checkInsByHabit = new Map<string, Set<string>>();
  for (const c of streakCheckIns) {
    let dates = checkInsByHabit.get(c.habitId);
    if (!dates) {
      dates = new Set();
      checkInsByHabit.set(c.habitId, dates);
    }
    dates.add(c.date);
  }
  const habitStreaks = streakHabits.map((habit) => ({
    habitId: habit.id,
    name: habit.name,
    streak: computeHabitStreak(habit, checkInsByHabit.get(habit.id) ?? new Set()),
  }));

  const todayScheduled = habits.filter((h) => isHabitScheduledOnDateForHabit(h, today));
  const todayCompleted = todayCheckIns.filter((c) => {
    const habit = habits.find((h) => h.id === c.habitId);
    return habit && isHabitScheduledOnDateForHabit(habit, today);
  }).length;

  const todayDayOfWeek = new Date().getDay();
  const weeklyTodaySchedule = scheduleBlocks.filter((b) => b.dayOfWeek === todayDayOfWeek);
  const todaySchedule =
    dayScheduleBlocks.length > 0
      ? dayScheduleBlocks.map((b) => ({
          id: b.id,
          title: b.title,
          startTime: b.startTime,
          endTime: b.endTime,
          color: b.color,
          source: "day" as const,
        }))
      : weeklyTodaySchedule.map((b) => ({
          id: b.id,
          title: b.title,
          startTime: b.startTime,
          endTime: b.endTime,
          color: b.color,
          source: "week" as const,
        }));

  scheduleAchievementSync();

  const [goals, upcomingContent, financeData, achievements, dailyLog, activeGoalsMeta] =
    await Promise.all([
    prisma.lifeGoal.findMany({
      where: { status: "ACTIVE" },
      include: {
        keyResults: true,
        projects: { select: { progress: true, status: true } },
      },
      take: 4,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.projectPlanStep.findMany({
      where: { done: false, project: brandingProjectFilter },
      select: { id: true, title: true, scheduledDate: true, projectId: true },
      orderBy: { scheduledDate: "asc" },
      take: 5,
    }),
    getFinanceDashboardSummary(),
    listAchievements(),
    prisma.dailyLog.findUnique({ where: { date: today } }),
    prisma.lifeGoal.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, title: true, updatedAt: true, status: true },
    }),
  ]);

  const activeGoals = goals.map((g) => ({
    id: g.id,
    title: g.title,
    area: g.area,
    progress: syncGoalProgress(g.projects),
  }));

  const recentAchievements = achievements.filter((a) => a.unlockedAt).slice(0, 4);
  const { summary: financeSummary, wealthHistory } = financeData;

  const dueMilestones = await prisma.projectMilestone.findMany({
    where: { completed: false, dueDate: { lte: new Date(Date.now() + 7 * 86400000) } },
    include: { project: { select: { id: true, name: true } } },
    take: 3,
  });

  const todayFocus: Array<{ type: string; label: string; detail: string; href: string }> = [];
  const checkedHabitIds = new Set(todayCheckIns.map((c) => c.habitId));

  const mustDo = parseMustDo(dailyLog?.mustDo);
  if (mustDo.length > 0) {
    const taskIds = mustDo.filter((m) => m.type === "task").map((m) => m.id);
    const mustDoTasks =
      taskIds.length > 0
        ? await prisma.taskItem.findMany({
            where: { id: { in: taskIds } },
            select: { id: true, completed: true },
          })
        : [];
    const completedTaskIds = new Set(mustDoTasks.filter((t) => t.completed).map((t) => t.id));
    const mustDoDone = mustDo.filter((m) => isMustDoDone(m, checkedHabitIds, completedTaskIds)).length;
    if (mustDoDone < mustDo.length) {
      todayFocus.push({
        type: "mustdo",
        label: `今日必做 ${mustDoDone}/${mustDo.length}`,
        detail: "优先完成必做项",
        href: "/daily",
      });
    }
  }

  if (isEveningReminderHour()) {
    const uncheckedIds = todayScheduled
      .filter((h) => !checkedHabitIds.has(h.id))
      .map((h) => h.id);
    if (uncheckedIds.length > 0) {
      const riskCheckIns = await prisma.habitCheckIn.findMany({
        where: { habitId: { in: uncheckedIds }, completed: true },
        select: { habitId: true, date: true },
      });
      const riskByHabit = new Map<string, Set<string>>();
      for (const c of riskCheckIns) {
        let dates = riskByHabit.get(c.habitId);
        if (!dates) {
          dates = new Set();
          riskByHabit.set(c.habitId, dates);
        }
        dates.add(c.date);
      }
      for (const h of todayScheduled.filter((x) => uncheckedIds.includes(x.id))) {
        const streak = computeHabitStreak(h, riskByHabit.get(h.id) ?? new Set());
        if (streak >= 2) {
          todayFocus.push({
            type: "streak",
            label: h.name,
            detail: `连续 ${streak} 天，今晚将断链`,
            href: "/daily",
          });
        }
      }
    }
  }

  for (const g of activeGoalsMeta.filter(isStaleGoal).slice(0, 2)) {
    todayFocus.push({
      type: "goal",
      label: g.title,
      detail: "目标已超过 14 天未更新",
      href: `/goals?id=${g.id}`,
    });
  }

  if (todayScheduled.length > 0) {
    const remaining = todayScheduled.length - todayCompleted;
    if (remaining > 0) {
      todayFocus.push({
        type: "habit",
        label: `习惯打卡 ${todayCompleted}/${todayScheduled.length}`,
        detail: remaining > 0 ? `还有 ${remaining} 项待完成` : "已全部完成",
        href: "/daily",
      });
    }
  }

  if (todayPomodoroCount > 0) {
    todayFocus.push({
      type: "pomodoro",
      label: `习惯专注 ${todayPomodoroCount} 番茄`,
      detail: `${todayFocusMinutes} 分钟深度工作`,
      href: "/daily",
    });
  }

  for (const block of todaySchedule.slice(0, 2)) {
    todayFocus.push({
      type: "schedule",
      label: block.title,
      detail: `${block.startTime}–${block.endTime}`,
      href: block.source === "day" ? "/daily" : "/calendar/week",
    });
  }

  for (const c of overdueContacts.slice(0, 2)) {
    todayFocus.push({
      type: "contact",
      label: c.name,
      detail: "待跟进联系",
      href: `/contacts?id=${c.id}`,
    });
  }

  for (const c of upcomingContent.slice(0, 2)) {
    todayFocus.push({
      type: "content",
      label: c.title,
      detail: c.scheduledDate ? `Branding · ${c.scheduledDate}` : PERSONAL_BRANDING_NAME,
      href: `/projects?id=${c.projectId}`,
    });
  }

  for (const m of dueMilestones) {
    todayFocus.push({
      type: "milestone",
      label: m.title,
      detail: m.project.name,
      href: `/projects?id=${m.project.id}`,
    });
  }

  return NextResponse.json({
    stats: {
      totalContacts: contacts.length,
      overdueContacts: overdueContacts.length,
      activeProjects: activeProjects.length,
      planningProjects: planningProjects.length,
      totalHabits: habits.length,
      todayCompleted,
      todayTotal: todayScheduled.length,
      weekCheckIns: weekCheckIns.length,
      todayPomodoroCount,
      todayFocusMinutes,
    },
    overdueContacts: overdueContacts.slice(0, 5),
    activeProjects: activeProjects.slice(0, 5),
    planningProjects: planningProjects.slice(0, 5),
    habitStreaks,
    todaySchedule,
    recentNotes,
    activeGoals,
    upcomingContent,
    financeSummary,
    wealthTrend: wealthHistory.slice(-6),
    todayFocus: todayFocus.slice(0, 8),
    recentAchievements,
    achievementProgress: {
      unlocked: achievements.filter((a) => a.unlockedAt).length,
      total: achievements.length,
    },
  });
}
