import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectCategory } from "@/lib/project-categories";
import { syncSubProjectMilestonesForChild } from "@/lib/project-subprojects";
import { persistKeyResultCompletion } from "@/lib/goal-command-center";
import { mergeMilestonesWithDerived } from "@/lib/milestone-steps";
import { mapStepsToDates, type ProjectPlanFields, type ProjectPlanStepDto } from "@/lib/project-plan";

type Params = { params: Promise<{ id: string }> };

const childProjectSelect = {
  id: true,
  name: true,
  status: true,
  progress: true,
  targetDate: true,
  category: { select: { name: true, color: true } },
} as const;

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const today = format(new Date(), "yyyy-MM-dd");
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      category: true,
      milestones: {
        orderBy: { sortOrder: "asc" },
        include: { childProject: { select: childProjectSelect } },
      },
      contacts: { include: { contact: { include: { category: true } } } },
      habits: { orderBy: { sortOrder: "asc" } },
      notes: { orderBy: [{ pinned: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }] },
      goal: { select: { id: true, title: true } },
      planSteps: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { planSteps, ...rest } = project;
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
  const steps: ProjectPlanStepDto[] = planSteps.map((s) => ({
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
  const milestones = mergeMilestonesWithDerived(planProject, project.milestones, steps, today);
  // 每个步骤排在哪天（已完成 = 完成日，未完成 = 自动排程日），最后一个未完成步骤的日期 = 按当前节奏的预计完成日
  const stepDates: Record<string, string> = {};
  for (const [d, list] of Object.entries(mapStepsToDates(planProject, steps, today).byDate)) {
    for (const st of list) stepDates[st.id] = d;
  }
  const openDates = steps.filter((st) => !st.done).map((st) => stepDates[st.id]).filter(Boolean).sort();
  const projectedFinish = openDates.length === steps.filter((st) => !st.done).length ? (openDates.at(-1) ?? null) : null;
  return NextResponse.json({ ...rest, milestones, planSteps: steps, stepDates, projectedFinish });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  let categoryId: string | null | undefined;
  if (body.categoryId !== undefined) {
    categoryId = body.categoryId || null;
  } else if (body.category !== undefined) {
    const cat = body.category ? await getOrCreateProjectCategory(body.category) : null;
    categoryId = cat?.id ?? null;
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.startDate !== undefined && {
        startDate: body.startDate ? new Date(body.startDate) : null,
      }),
      ...(body.targetDate !== undefined && {
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
      }),
      ...(body.completedAt !== undefined && {
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
      }),
      ...(body.progress !== undefined && { progress: body.progress }),
      ...(body.tags !== undefined && { tags: JSON.stringify(body.tags) }),
      ...(body.goalId !== undefined && { goalId: body.goalId || null }),
      ...(categoryId !== undefined && { categoryId }),
      ...(body.ideaDate !== undefined && {
        ideaDate: body.ideaDate ? new Date(body.ideaDate) : null,
      }),
      ...(body.archiveDate !== undefined && {
        archiveDate: body.archiveDate ? new Date(body.archiveDate) : null,
      }),
      ...(body.wishFinishTime !== undefined && { wishFinishTime: body.wishFinishTime || null }),
      ...(body.pinned !== undefined && { pinned: body.pinned }),
    },
    include: { category: true },
  });

  if (body.status !== undefined) {
    await syncSubProjectMilestonesForChild(prisma, id, body.status);
  }

  if (
    project.goalId &&
    (body.status !== undefined || body.progress !== undefined || body.archiveDate !== undefined)
  ) {
    await persistKeyResultCompletion(project.goalId);
  }

  return NextResponse.json(project);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
