import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getWeekRange, getWeekStart, habitHasTimeBlock } from "@/lib/utils";
import { syncGoalProgress, enrichKeyResults, deriveKeyResultCompleted } from "@/lib/goal-progress";
import {
  computeGoalCertainty,
  type GoalCertaintyInput,
} from "@/lib/goal-certainty";

const MOMENTUM_DAYS = 14;

type GoalWithRelations = Awaited<ReturnType<typeof fetchGoalRelations>>;

async function fetchGoalRelations(goalId: string) {
  return prisma.lifeGoal.findUnique({
    where: { id: goalId },
    include: {
      keyResults: {
        orderBy: { sortOrder: "asc" },
        include: {
          projects: {
            include: {
              project: {
                select: { id: true, name: true, progress: true, status: true, archiveDate: true },
              },
            },
          },
        },
      },
      contacts: { include: { contact: { include: { category: true } } } },
      projects: {
        include: {
          contacts: { include: { contact: { include: { category: true } } } },
          milestones: true,
          habits: { where: { isActive: true }, include: { schedules: { where: { isActive: true } } } },
          tasks: { where: { completed: false, cancelled: false } },
        },
      },
      scheduleBlocks: { where: { isActive: true }, include: { habit: true } },
      directTasks: { where: { completed: false, cancelled: false } },
    },
  });
}

function countUniqueContacts(goal: NonNullable<GoalWithRelations>) {
  const ids = new Set<string>();
  for (const gc of goal.contacts) ids.add(gc.contactId);
  for (const p of goal.projects) {
    for (const pc of p.contacts) ids.add(pc.contactId);
  }
  return ids.size;
}

function mergeContacts(goal: NonNullable<GoalWithRelations>) {
  const map = new Map<
    string,
    {
      id: string;
      contactId: string;
      role: string | null;
      source: "direct" | "project";
      projectName?: string;
      contact: (typeof goal.contacts)[0]["contact"];
    }
  >();

  for (const gc of goal.contacts) {
    map.set(gc.contactId, {
      id: gc.id,
      contactId: gc.contactId,
      role: gc.role,
      source: "direct",
      contact: gc.contact,
    });
  }

  for (const p of goal.projects) {
    for (const pc of p.contacts) {
      if (!map.has(pc.contactId)) {
        map.set(pc.contactId, {
          id: pc.id,
          contactId: pc.contactId,
          role: pc.role,
          source: "project",
          projectName: p.name,
          contact: pc.contact,
        });
      }
    }
  }

  return Array.from(map.values());
}

function countActionableAffairs(goal: NonNullable<GoalWithRelations>) {
  let count = 0;
  for (const p of goal.projects) {
    count += p.milestones.filter((m) => !m.completed && m.dueDate).length;
    count += p.tasks.filter((t) => t.dueDate || t.scheduledDate).length;
  }
  count += goal.directTasks.length;
  return count;
}

function collectScheduleBlocks(goal: NonNullable<GoalWithRelations>) {
  const blocks = [...goal.scheduleBlocks];
  const seen = new Set(blocks.map((b) => b.id));

  for (const p of goal.projects) {
    for (const h of p.habits) {
      for (const s of h.schedules) {
        if (!seen.has(s.id)) {
          blocks.push({ ...s, habit: h });
          seen.add(s.id);
        }
      }
    }
  }

  return blocks;
}

function countScheduledHabits(goal: NonNullable<GoalWithRelations>) {
  const habitIds = new Set<string>();
  for (const p of goal.projects) {
    for (const h of p.habits) {
      if (habitHasTimeBlock(h) || h.schedules.length > 0) {
        habitIds.add(h.id);
      }
    }
  }
  return habitIds.size;
}

async function checkRecentActivity(goalId: string, projectIds: string[]) {
  const since = subDays(new Date(), MOMENTUM_DAYS);

  const [projectUpdates, checkIns, pomodoros, taskUpdates] = await Promise.all([
    projectIds.length > 0
      ? prisma.project.count({
          where: { id: { in: projectIds }, updatedAt: { gte: since } },
        })
      : 0,
    prisma.habitCheckIn.count({
      where: {
        completed: true,
        completedAt: { gte: since },
        habit: { project: { goalId } },
      },
    }),
    prisma.pomodoroSession.count({
      where: {
        status: "completed",
        endedAt: { gte: since },
        habit: { project: { goalId } },
      },
    }),
    prisma.taskItem.count({
      where: {
        OR: [{ goalId }, { projectId: { in: projectIds } }],
        updatedAt: { gte: since },
      },
    }),
  ]);

  return projectUpdates + checkIns + pomodoros + taskUpdates > 0;
}

async function getPomodoroMinutesThisWeek(goalId: string) {
  const ws = getWeekStart();
  const { start, end } = getWeekRange(new Date(`${ws}T12:00:00`));

  const sessions = await prisma.pomodoroSession.findMany({
    where: {
      date: { gte: start, lte: end },
      status: "completed",
      habit: { project: { goalId } },
    },
    select: { actualMinutes: true, plannedMinutes: true },
  });

  return sessions.reduce((sum, s) => sum + (s.actualMinutes ?? s.plannedMinutes), 0);
}

async function getGoalSpending(goal: NonNullable<GoalWithRelations>) {
  const projectIds = goal.projects.map((p) => p.id);
  if (projectIds.length === 0) return 0;

  const txs = await prisma.transaction.findMany({
    where: { projectId: { in: projectIds }, type: "expense" },
    select: { amount: true },
  });

  return txs.reduce((sum, t) => sum + t.amount, 0);
}

function buildCertaintyInputFromGoal(
  goal: NonNullable<GoalWithRelations>,
  hasRecentActivity: boolean
): GoalCertaintyInput {
  const activeProjects = goal.projects.filter((p) => p.status === "ACTIVE");
  const scheduleBlocks = collectScheduleBlocks(goal);

  return {
    area: goal.area,
    budgetAmount: goal.budgetAmount,
    resourceNote: goal.resourceNote,
    whyItMatters: goal.whyItMatters,
    contactCount: countUniqueContacts(goal),
    activeProjectCount: activeProjects.length,
    actionableAffairCount: countActionableAffairs(goal),
    scheduleBlockCount: scheduleBlocks.length,
    scheduledHabitCount: countScheduledHabits(goal),
    hasRecentActivity,
  };
}

export async function persistKeyResultCompletion(goalId: string) {
  const krs = await prisma.goalKeyResult.findMany({
    where: { goalId },
    include: {
      projects: {
        include: {
          project: { select: { progress: true, status: true, archiveDate: true } },
        },
      },
    },
  });
  await Promise.all(
    krs.map((kr) => {
      const completed = deriveKeyResultCompleted(kr.projects.map((lp) => lp.project));
      if (kr.completed === completed) return Promise.resolve();
      return prisma.goalKeyResult.update({ where: { id: kr.id }, data: { completed } });
    })
  );
}

export async function fetchGoalCommandCenter(goalId: string) {
  const goal = await fetchGoalRelations(goalId);
  if (!goal) return null;

  await persistKeyResultCompletion(goalId);
  const goalRefreshed = await fetchGoalRelations(goalId);
  if (!goalRefreshed) return null;
  const goalData = goalRefreshed;

  const projectIds = goalData.projects.map((p) => p.id);
  const [hasRecentActivity, pomodoroMinutesWeek, spending] = await Promise.all([
    checkRecentActivity(goalId, projectIds),
    getPomodoroMinutesThisWeek(goalId),
    goalData.area === "finance" ? getGoalSpending(goalData) : Promise.resolve(0),
  ]);

  const keyResults = enrichKeyResults(goalData.keyResults);

  const certainty = computeGoalCertainty(
    buildCertaintyInputFromGoal(goalData, hasRecentActivity)
  );

  const contacts = mergeContacts(goalData);
  const scheduleBlocks = collectScheduleBlocks(goalData);

  const nextActions = [
    ...goalData.directTasks.map((t) => ({ ...t, source: "goal" as const })),
    ...goalData.projects.flatMap((p) =>
      p.tasks.slice(0, 5).map((t) => ({ ...t, source: "project" as const, projectName: p.name }))
    ),
  ].slice(0, 10);

  return {
    ...goalData,
    keyResults,
    progress: syncGoalProgress(goalData.projects),
    contacts,
    scheduleBlocks,
    nextActions,
    pomodoroMinutesWeek,
    spending,
    certainty,
  };
}

const listInclude = {
  keyResults: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      projects: {
        include: {
          project: { select: { id: true, name: true, progress: true, status: true, archiveDate: true } },
        },
      },
    },
  },
  contacts: true,
  projects: {
    select: {
      id: true,
      name: true,
      progress: true,
      status: true,
      updatedAt: true,
      contacts: { select: { contactId: true } },
      milestones: { where: { completed: false }, select: { dueDate: true } },
      habits: {
        where: { isActive: true },
        select: {
          id: true,
          scheduleMode: true,
          startTime: true,
          endTime: true,
          schedules: { where: { isActive: true }, select: { id: true } },
        },
      },
      tasks: {
        where: { completed: false, cancelled: false },
        select: { id: true, dueDate: true, scheduledDate: true },
      },
    },
  },
  scheduleBlocks: { where: { isActive: true }, select: { id: true } },
  directTasks: {
    where: { completed: false, cancelled: false },
    select: { id: true, dueDate: true, scheduledDate: true },
  },
  _count: { select: { projects: true } },
};

export async function fetchGoalsWithCertainty() {
  const goals = await prisma.lifeGoal.findMany({
    include: listInclude,
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
  });

  const since = subDays(new Date(), MOMENTUM_DAYS);
  const allProjectIds = goals.flatMap((g) => g.projects.map((p) => p.id));

  const [recentProjects, recentCheckIns, recentPomodoros, recentTasks] = await Promise.all([
    allProjectIds.length > 0
      ? prisma.project.findMany({
          where: { id: { in: allProjectIds }, updatedAt: { gte: since } },
          select: { id: true },
        })
      : [],
    prisma.habitCheckIn.findMany({
      where: { completed: true, completedAt: { gte: since } },
      select: { habit: { select: { project: { select: { goalId: true } } } } },
    }),
    prisma.pomodoroSession.findMany({
      where: { status: "completed", endedAt: { gte: since } },
      select: { habit: { select: { project: { select: { goalId: true } } } } },
    }),
    prisma.taskItem.findMany({
      where: {
        updatedAt: { gte: since },
        OR: [{ goalId: { not: null } }, { projectId: { in: allProjectIds } }],
      },
      select: { goalId: true, project: { select: { goalId: true } } },
    }),
  ]);

  const activeGoalIds = new Set<string>();
  for (const p of recentProjects) {
    const goal = goals.find((g) => g.projects.some((pr) => pr.id === p.id));
    if (goal) activeGoalIds.add(goal.id);
  }
  for (const c of recentCheckIns) {
    if (c.habit.project?.goalId) activeGoalIds.add(c.habit.project.goalId);
  }
  for (const p of recentPomodoros) {
    if (p.habit.project?.goalId) activeGoalIds.add(p.habit.project.goalId);
  }
  for (const t of recentTasks) {
    if (t.goalId) activeGoalIds.add(t.goalId);
    if (t.project?.goalId) activeGoalIds.add(t.project.goalId);
  }

  return goals.map((g) => {
    const contactIds = new Set<string>();
    for (const gc of g.contacts) contactIds.add(gc.contactId);
    for (const p of g.projects) {
      for (const pc of p.contacts) contactIds.add(pc.contactId);
    }

    const activeProjectCount = g.projects.filter((p) => p.status === "ACTIVE").length;
    let actionableAffairCount = g.directTasks.length;
    for (const p of g.projects) {
      actionableAffairCount += p.milestones.filter((m) => m.dueDate).length;
      actionableAffairCount += p.tasks.filter((t) => t.dueDate || t.scheduledDate).length;
    }

    let scheduleBlockCount = g.scheduleBlocks.length;
    let scheduledHabitCount = 0;
    for (const p of g.projects) {
      for (const h of p.habits) {
        scheduleBlockCount += h.schedules.length;
        if (habitHasTimeBlock(h) || h.schedules.length > 0) scheduledHabitCount += 1;
      }
    }

    const certainty = computeGoalCertainty({
      area: g.area,
      budgetAmount: g.budgetAmount,
      resourceNote: g.resourceNote,
      whyItMatters: g.whyItMatters,
      contactCount: contactIds.size,
      activeProjectCount,
      actionableAffairCount,
      scheduleBlockCount,
      scheduledHabitCount,
      hasRecentActivity: activeGoalIds.has(g.id),
    });

    return {
      ...g,
      keyResults: enrichKeyResults(g.keyResults),
      progress: syncGoalProgress(g.projects),
      certainty,
    };
  });
}
