import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ROW_ORDER_SOURCE,
  collectTimelinePayload,
  parseRowOrder,
  parseScale,
  showsStepPoints,
  todayKey,
  type GoalTimelineInput,
  type MeetingTimelineInput,
  type OpportunityTimelineInput,
  type PhaseTimelineInput,
  type ProjectTimelineInput,
  type TimelineOverrideInput,
} from "@/lib/timeline";

const PROJECT_SELECT = {
  id: true,
  name: true,
  status: true,
  progress: true,
  sortOrder: true,
  pinned: true,
  archiveDate: true,
  startDate: true,
  targetDate: true,
  completedAt: true,
  planActive: true,
  planWorkdays: true,
  planAnchorDate: true,
  planSkipDates: true,
  planExtraDates: true,
  category: { select: { color: true } },
  milestones: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      title: true,
      dueDate: true,
      completed: true,
      sortOrder: true,
    },
  },
};

const PLAN_STEP_SELECT = {
  orderBy: { sortOrder: "asc" as const },
  select: {
    id: true,
    projectId: true,
    sortOrder: true,
    title: true,
    detail: true,
    estMinutes: true,
    milestoneId: true,
    isMilestone: true,
    done: true,
    doneDate: true,
    scheduledDate: true,
  },
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const scale = parseScale(searchParams.get("scale"));
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const today = todayKey();

  const [projects, goals, phases, opportunities, meetings, overrides] = await Promise.all([
    prisma.project.findMany({
      // 已取消的项目不上时间线
      where: { status: { not: "CANCELLED" } },
      select: showsStepPoints(scale)
        ? { ...PROJECT_SELECT, planSteps: PLAN_STEP_SELECT }
        : PROJECT_SELECT,
    }),
    prisma.lifeGoal.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, title: true, area: true, status: true, targetDate: true },
    }),
    prisma.lifeStrategyPhase.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        summary: true,
        status: true,
        startDate: true,
        endDate: true,
        sortOrder: true,
      },
    }),
    prisma.opportunity.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        deadline: true,
        nextAction: true,
        projectId: true,
        goalId: true,
      },
    }),
    prisma.meeting.findMany({
      where: { status: { not: "Cancelled" } },
      select: {
        id: true,
        title: true,
        status: true,
        meetingDate: true,
        meetingTime: true,
        projectId: true,
      },
    }),
    prisma.timelineOverride.findMany(),
  ]);

  const payload = collectTimelinePayload({
    today,
    scale,
    start,
    end,
    projects: projects.map((project) => ({
      ...project,
      planSteps: "planSteps" in project ? project.planSteps : [],
    })) as ProjectTimelineInput[],
    goals: goals as GoalTimelineInput[],
    phases: phases as PhaseTimelineInput[],
    opportunities: opportunities as OpportunityTimelineInput[],
    meetings: meetings as MeetingTimelineInput[],
    overrides: overrides.filter((o) => o.source !== ROW_ORDER_SOURCE) as TimelineOverrideInput[],
    rowOrder: parseRowOrder(overrides),
  });

  return NextResponse.json(payload);
}
