import { prisma } from "@/lib/prisma";
import { brandingProjectFilter } from "@/lib/branding";
import { parseDaysOfWeek } from "@/lib/reminders";
import { subDays, format } from "date-fns";

export type AchievementDef = {
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
};

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { code: "first_habit", title: "习惯启程", description: "创建第一个习惯", icon: "🌱", category: "habit" },
  { code: "habit_streak_7", title: "一周坚持", description: "任一习惯连续打卡 7 次", icon: "🔥", category: "habit" },
  { code: "habit_streak_30", title: "月度达人", description: "任一习惯连续打卡 30 次", icon: "💪", category: "habit" },
  { code: "first_project", title: "项目启动", description: "创建第一个项目", icon: "🚀", category: "project" },
  { code: "project_complete", title: "项目交付", description: "完成第一个项目", icon: "✅", category: "project" },
  { code: "projects_5", title: "多线作战", description: "累计完成 5 个项目", icon: "🎯", category: "project" },
  { code: "first_goal", title: "愿景初立", description: "设定第一个人生目标", icon: "⭐", category: "goal" },
  { code: "goal_complete", title: "目标达成", description: "完成第一个人生目标", icon: "🏆", category: "goal" },
  { code: "first_publish", title: "首次发布", description: "发布第一篇推广内容", icon: "📣", category: "promotion" },
  { code: "content_10", title: "内容创作者", description: "累计发布 10 篇内容", icon: "✍️", category: "promotion" },
  { code: "first_transaction", title: "记账开始", description: "记录第一笔收支", icon: "💰", category: "finance" },
  { code: "finance_month", title: "理财自律", description: "本月记账至少 10 笔", icon: "📊", category: "finance" },
  { code: "first_review", title: "复盘习惯", description: "完成第一次周复盘", icon: "📝", category: "review" },
  { code: "contacts_10", title: "人脉经营", description: "管理 10 位以上联系人", icon: "🤝", category: "contact" },
];

function computeStreak(daysOfWeek: string, checkInDates: Set<string>, maxDays = 60): number {
  const scheduledDays = parseDaysOfWeek(daysOfWeek);
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < maxDays; i++) {
    const d = subDays(today, i);
    const dateStr = format(d, "yyyy-MM-dd");
    if (!scheduledDays.includes(d.getDay())) continue;
    if (checkInDates.has(dateStr)) streak++;
    else break;
  }
  return streak;
}

async function maxHabitStreak(): Promise<number> {
  const habits = await prisma.habit.findMany({ where: { isActive: true } });
  if (habits.length === 0) return 0;

  const checkIns = await prisma.habitCheckIn.findMany({
    where: { habitId: { in: habits.map((h) => h.id) }, completed: true },
    select: { habitId: true, date: true },
  });

  const byHabit = new Map<string, Set<string>>();
  for (const c of checkIns) {
    let dates = byHabit.get(c.habitId);
    if (!dates) {
      dates = new Set();
      byHabit.set(c.habitId, dates);
    }
    dates.add(c.date);
  }

  let max = 0;
  for (const habit of habits) {
    const streak = computeStreak(habit.daysOfWeek, byHabit.get(habit.id) ?? new Set());
    max = Math.max(max, streak);
  }
  return max;
}

export async function syncAchievements() {
  await Promise.all(
    ACHIEVEMENT_DEFS.map((def) =>
      prisma.achievement.upsert({
        where: { code: def.code },
        create: { ...def, unlockedAt: null },
        update: { title: def.title, description: def.description, icon: def.icon, category: def.category },
      })
    )
  );

  const [
    habitCount,
    projectCount,
    completedProjects,
    goalCount,
    completedGoals,
    publishedContent,
    transactionCount,
    reviewCount,
    contactCount,
    monthStart,
  ] = await Promise.all([
    prisma.habit.count(),
    prisma.project.count(),
    prisma.project.count({ where: { status: "COMPLETED" } }),
    prisma.lifeGoal.count(),
    prisma.lifeGoal.count({ where: { status: "COMPLETED" } }),
    prisma.projectPlanStep.count({
      where: {
        done: true,
        isMilestone: true,
        project: brandingProjectFilter,
      },
    }),
    prisma.transaction.count(),
    prisma.weeklyReview.count(),
    prisma.contact.count(),
    format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
  ]);

  const monthTransactions = await prisma.transaction.count({
    where: { date: { gte: monthStart } },
  });
  const maxStreak = await maxHabitStreak();

  const unlocks: Record<string, boolean> = {
    first_habit: habitCount >= 1,
    habit_streak_7: maxStreak >= 7,
    habit_streak_30: maxStreak >= 30,
    first_project: projectCount >= 1,
    project_complete: completedProjects >= 1,
    projects_5: completedProjects >= 5,
    first_goal: goalCount >= 1,
    goal_complete: completedGoals >= 1,
    first_publish: publishedContent >= 1,
    content_10: publishedContent >= 10,
    first_transaction: transactionCount >= 1,
    finance_month: monthTransactions >= 10,
    first_review: reviewCount >= 1,
    contacts_10: contactCount >= 10,
  };

  const now = new Date();
  const toUnlock = Object.entries(unlocks).filter(([code, shouldUnlock]) => shouldUnlock);
  if (toUnlock.length > 0) {
    const existing = await prisma.achievement.findMany({
      where: { code: { in: toUnlock.map(([code]) => code) }, unlockedAt: null },
    });
    await Promise.all(
      existing.map((row) =>
        prisma.achievement.update({ where: { code: row.code }, data: { unlockedAt: now } })
      )
    );
  }

  return listAchievements();
}

export function listAchievements() {
  return prisma.achievement.findMany({ orderBy: [{ unlockedAt: "desc" }, { category: "asc" }] });
}

/** Fire-and-forget sync so GET handlers stay fast. */
export function scheduleAchievementSync() {
  void syncAchievements().catch(() => {});
}

export { syncGoalProgress, isProjectDone, deriveKeyResultCompleted, enrichKeyResults } from "@/lib/goal-progress";
