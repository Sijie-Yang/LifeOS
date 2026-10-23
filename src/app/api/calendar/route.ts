import { NextRequest, NextResponse } from "next/server";
import { CLOSED_PROJECT_STATUSES } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { format, parseISO } from "date-fns";
import { isHabitForCalendar, isHabitScheduledOnDateForHabit } from "@/lib/reminders";
import { getDefaultOccurrenceDate } from "@/lib/day-schedule";
import {
  filterByDateRange,
  getMonthDateRange,
  getWorkDaysFrom,
  mapStepsToDates,
  type MappedPlanStep,
  type ProjectPlanFields,
  type ProjectPlanStepDto,
} from "@/lib/project-plan";

export type CalendarHabitItem = {
  id: string;
  name: string;
  color: string;
  scheduleMode: string;
  description: string | null;
  cue: string | null;
  minimumVersion: string | null;
  startTime: string | null;
  endTime: string | null;
  defaultStartTime: string | null;
  defaultEndTime: string | null;
  scheduleBlockId: string | null;
  dayOverrideId: string | null;
  timeOverridden: boolean;
  dateOverridden: boolean;
  skipped: boolean;
  defaultOccurrenceDate: string | null;
  occurrenceDate: string;
  projectId: string | null;
  projectName: string | null;
  checked: boolean;
};

export type CalendarMeetingItem = {
  id: string;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  status: string;
  purpose: string | null;
  category: string;
  projectId: string | null;
  projectName: string | null;
  attendees: Array<{ id: string; name: string }>;
};

export type CalendarPromotionItem = {
  id: string;
  title: string;
  publishDate: string;
  status: string;
  format: string | null;
  templateId: string | null;
  templateName: string | null;
  templateReferenceUrl: string | null;
  channelId: string;
  channelName: string;
  channelPlatform: string;
  projectId: string | null;
  projectName: string | null;
  notes: string | null;
};

export type CalendarOpportunityItem = {
  id: string;
  title: string;
  deadline: string;
  status: string;
  lane: string;
  category: string;
  priority: string;
  nextAction: string | null;
  projectId: string | null;
  projectName: string | null;
  contacts: Array<{ id: string; name: string }>;
};

export type CalendarDayPayload = {
  steps: MappedPlanStep[];
  habits: CalendarHabitItem[];
  meetings: CalendarMeetingItem[];
  promotion: CalendarPromotionItem[];
  opportunities: CalendarOpportunityItem[];
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const month = searchParams.get("month") ?? format(new Date(), "yyyy-MM");
  const projectId = searchParams.get("projectId");
  const today = format(new Date(), "yyyy-MM-dd");
  const { start, end } = getMonthDateRange(month);

  // 指定项目时不过滤 planActive，便于在日历里打开「未开」项目
  const projectWhere = projectId
    ? { id: projectId }
    : { planActive: true, status: { notIn: CLOSED_PROJECT_STATUSES }, archiveDate: null };

  const [projects, habits, meetings, opportunities, dayHabitBlocks, weeklyScheduleBlocks, checkIns] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      include: {
        category: { select: { color: true } },
        planSteps: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.habit.findMany({
      where: {
        isActive: true,
        OR: [
          { scheduleMode: "monthly" },
          { scheduleMode: "weekly", frequency: "WEEKLY" },
        ],
      },
      select: {
        id: true,
        name: true,
        color: true,
        scheduleMode: true,
        frequency: true,
        daysOfWeek: true,
        monthDays: true,
        description: true,
        cue: true,
        minimumVersion: true,
        startTime: true,
        endTime: true,
        projectId: true,
        project: { select: { name: true } },
      },
    }),
    prisma.meeting.findMany({
      where: {
        meetingDate: { gte: start, lte: end },
        status: { not: "Cancelled" },
      },
      include: {
        project: { select: { id: true, name: true } },
        attendees: {
          include: { contact: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ meetingDate: "asc" }, { meetingTime: "asc" }],
    }),
    prisma.opportunity.findMany({
      where: {
        deadline: { gte: start, lte: end },
        status: { notIn: ["Lost", "Passed", "Archived"] },
      },
      include: {
        project: { select: { id: true, name: true } },
        contacts: {
          include: { contact: { select: { id: true, name: true } } },
        },
      },
      orderBy: { deadline: "asc" },
    }),
    prisma.dayScheduleBlock.findMany({
      where: {
        date: { gte: start, lte: end },
        habitId: { not: null },
      },
      select: {
        id: true,
        date: true,
        habitId: true,
        scheduleBlockId: true,
        startTime: true,
        endTime: true,
        skipped: true,
      },
    }),
    prisma.scheduleBlock.findMany({
      where: { isActive: true, habitId: { not: null } },
      select: { id: true, habitId: true, dayOfWeek: true },
    }),
    prisma.habitCheckIn.findMany({
      where: {
        date: { gte: start, lte: end },
        completed: true,
      },
      select: { habitId: true, date: true },
    }),
  ]);

  const checkInSet = new Set(checkIns.map((c) => `${c.date}:${c.habitId}`));

  const overrideByHabitDate = new Map<
    string,
    { id: string; startTime: string; endTime: string; scheduleBlockId: string | null }
  >();
  const skippedByHabitDate = new Map<
    string,
    { id: string; startTime: string; endTime: string; scheduleBlockId: string | null }
  >();

  for (const block of dayHabitBlocks) {
    if (!block.habitId) continue;
    const key = `${block.date}:${block.habitId}`;
    const info = {
      id: block.id,
      startTime: block.startTime,
      endTime: block.endTime,
      scheduleBlockId: block.scheduleBlockId,
    };
    if (block.skipped) {
      skippedByHabitDate.set(key, info);
      continue;
    }
    overrideByHabitDate.set(key, info);
  }

  const scheduleBlockByHabitDow = new Map<string, string>();
  for (const sb of weeklyScheduleBlocks) {
    if (sb.habitId) {
      scheduleBlockByHabitDow.set(`${sb.habitId}:${sb.dayOfWeek}`, sb.id);
    }
  }

  const days: Record<string, CalendarDayPayload> = {};

  const ensureDay = (date: string) => {
    if (!days[date]) {
      days[date] = { steps: [], habits: [], meetings: [], promotion: [], opportunities: [] };
    }
  };

  for (const project of projects) {
    const planProject: ProjectPlanFields = {
      id: project.id,
      name: project.name,
      planActive: project.planActive,
      planWorkdays: project.planWorkdays,
      planAnchorDate: project.planAnchorDate,
      planSkipDates: project.planSkipDates,
      planExtraDates: project.planExtraDates,
      startDate: project.startDate,
      category: project.category,
    };

    const steps: ProjectPlanStepDto[] = project.planSteps.map((s) => ({
      id: s.id,
      projectId: s.projectId,
      sortOrder: s.sortOrder,
      title: s.title,
      detail: s.detail,
      estMinutes: s.estMinutes,
      milestoneId: s.milestoneId,
      isMilestone: s.isMilestone,
      done: s.done,
      doneDate: s.doneDate,
      scheduledDate: s.scheduledDate,
    }));

    const { byDate } = mapStepsToDates(planProject, steps, today);
    const filtered = filterByDateRange(byDate, start, end);

    for (const [date, mappedSteps] of Object.entries(filtered)) {
      ensureDay(date);
      days[date].steps.push(...mappedSteps);
    }
  }

  for (let d = start; d <= end; ) {
    ensureDay(d);
    for (const habit of habits) {
      if (!isHabitForCalendar(habit)) continue;

      const habitKey = `${d}:${habit.id}`;
      const isScheduledDay = isHabitScheduledOnDateForHabit(habit, d);
      const override = overrideByHabitDate.get(habitKey);
      const skippedBlock = skippedByHabitDate.get(habitKey);
      const isSkipped = Boolean(skippedBlock);

      if (isScheduledDay) {
        if (isSkipped) {
          // 改期挪走留下的 skip：不在原日显示；用户主动跳过：显示并标注
          let movedAway = false;
          for (const [otherKey] of overrideByHabitDate) {
            if (!otherKey.endsWith(`:${habit.id}`)) continue;
            const otherDate = otherKey.slice(0, 10);
            if (otherDate === d) continue;
            if (getDefaultOccurrenceDate(habit, otherDate) === d) {
              movedAway = true;
              break;
            }
          }
          if (movedAway) continue;
        }
      } else if (!override) {
        continue;
      }

      const blockInfo = override ?? skippedBlock ?? null;
      const dow = parseISO(`${d}T12:00:00`).getDay();
      const scheduleBlockId =
        blockInfo?.scheduleBlockId ?? scheduleBlockByHabitDow.get(`${habit.id}:${dow}`) ?? null;
      const defaultOccurrenceDate = getDefaultOccurrenceDate(habit, d);
      const dateOverridden = defaultOccurrenceDate != null && d !== defaultOccurrenceDate;

      days[d].habits.push({
        id: habit.id,
        name: habit.name,
        color: habit.color,
        scheduleMode: habit.scheduleMode,
        description: habit.description,
        cue: habit.cue,
        minimumVersion: habit.minimumVersion,
        startTime: blockInfo?.startTime ?? habit.startTime,
        endTime: blockInfo?.endTime ?? habit.endTime,
        defaultStartTime: habit.startTime,
        defaultEndTime: habit.endTime,
        scheduleBlockId,
        dayOverrideId: blockInfo?.id ?? null,
        timeOverridden: Boolean(
          override &&
            (override.startTime !== habit.startTime || override.endTime !== habit.endTime)
        ),
        dateOverridden,
        skipped: isSkipped,
        defaultOccurrenceDate,
        occurrenceDate: d,
        projectId: habit.projectId,
        projectName: habit.project?.name ?? null,
        checked: checkInSet.has(habitKey),
      });
    }
    const next = new Date(`${d}T12:00:00`);
    next.setDate(next.getDate() + 1);
    d = format(next, "yyyy-MM-dd");
  }

  for (const meeting of meetings) {
    ensureDay(meeting.meetingDate);
    days[meeting.meetingDate].meetings.push({
      id: meeting.id,
      title: meeting.title,
      meetingDate: meeting.meetingDate,
      meetingTime: meeting.meetingTime,
      status: meeting.status,
      purpose: meeting.purpose,
      category: meeting.category,
      projectId: meeting.projectId,
      projectName: meeting.project?.name ?? null,
      attendees: meeting.attendees.map((a) => ({
        id: a.contact.id,
        name: a.contact.name,
      })),
    });
  }

  for (const opp of opportunities) {
    if (!opp.deadline) continue;
    ensureDay(opp.deadline);
    days[opp.deadline].opportunities.push({
      id: opp.id,
      title: opp.title,
      deadline: opp.deadline,
      status: opp.status,
      lane: opp.lane,
      category: opp.category,
      priority: opp.priority,
      nextAction: opp.nextAction,
      projectId: opp.projectId,
      projectName: opp.project?.name ?? null,
      contacts: opp.contacts.map((c) => ({
        id: c.contact.id,
        name: c.contact.name,
      })),
    });
  }

  // 顶栏 / 下拉：所有未归档、未完成且有 plan steps 的项目（含未开 planActive，便于发现）
  const projectSummaries = await prisma.project.findMany({
    where: {
      archiveDate: null,
      status: { notIn: CLOSED_PROJECT_STATUSES },
      planSteps: { some: {} },
    },
    select: {
      id: true,
      name: true,
      planActive: true,
      planWorkdays: true,
      planSkipDates: true,
      planExtraDates: true,
      planAnchorDate: true,
      startDate: true,
      category: { select: { color: true } },
      planSteps: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ planActive: "desc" }, { name: "asc" }],
  });

  const nextByProject = projectSummaries.map((p) => {
    const planProject: ProjectPlanFields = {
      id: p.id,
      name: p.name,
      planActive: p.planActive,
      planWorkdays: p.planWorkdays,
      planAnchorDate: p.planAnchorDate,
      planSkipDates: p.planSkipDates,
      planExtraDates: p.planExtraDates,
      startDate: p.startDate,
      category: p.category,
    };
    const steps: ProjectPlanStepDto[] = p.planSteps.map((s) => ({
      id: s.id,
      projectId: s.projectId,
      sortOrder: s.sortOrder,
      title: s.title,
      detail: s.detail,
      estMinutes: s.estMinutes,
      milestoneId: s.milestoneId,
      isMilestone: s.isMilestone,
      done: s.done,
      doneDate: s.doneDate,
      scheduledDate: s.scheduledDate,
    }));
    const openCount = steps.filter((s) => !s.done).length;
    const { nextWorkday, nextStep } = mapStepsToDates(planProject, steps, today);
    // 积压 = 下一步早于「今天或今天之后的下一个项目工作日」（周末也能正确标红）
    const catchUpTarget =
      getWorkDaysFrom(planProject, today, 1)[0] ?? today;
    const overdue = Boolean(nextWorkday && nextWorkday < catchUpTarget && openCount > 0);
    return {
      projectId: p.id,
      projectName: p.name,
      projectColor: p.category?.color ?? "#6366f1",
      planActive: p.planActive,
      totalSteps: steps.length,
      openCount,
      overdue,
      catchUpTarget,
      nextWorkday,
      nextStep,
    };
  });

  const selectedProject = projectId
    ? projectSummaries.find((p) => p.id === projectId) ?? null
    : null;

  return NextResponse.json({
    month,
    today,
    range: { start, end },
    days,
    projects: projectSummaries.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.category?.color ?? "#6366f1",
      planActive: p.planActive,
      openCount: p.planSteps.filter((s) => !s.done).length,
      totalSteps: p.planSteps.length,
    })),
    selectedProject: selectedProject
      ? {
          id: selectedProject.id,
          name: selectedProject.name,
          planActive: selectedProject.planActive,
          planWorkdays: selectedProject.planWorkdays,
          planSkipDates: selectedProject.planSkipDates,
          planExtraDates: selectedProject.planExtraDates,
          planAnchorDate: selectedProject.planAnchorDate,
          startDate: selectedProject.startDate,
        }
      : null,
    nextByProject,
  });
}
