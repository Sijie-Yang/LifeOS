import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getOrCreateProjectCategory } from "@/lib/project-categories";
import { mergeMilestonesWithDerived } from "@/lib/milestone-steps";
import { type ProjectPlanFields, type ProjectPlanStepDto } from "@/lib/project-plan";

export async function GET() {
  const today = format(new Date(), "yyyy-MM-dd");

  const projects = await prisma.project.findMany({
    include: {
      category: true,
      milestones: {
        orderBy: { sortOrder: "asc" },
        include: {
          childProject: {
            select: { id: true, status: true, progress: true },
          },
        },
      },
      contacts: { include: { contact: true } },
      habits: { where: { isActive: true } },
      goal: { select: { id: true, title: true } },
      planSteps: { orderBy: { sortOrder: "asc" } },
      _count: { select: { notes: true } },
    },
    orderBy: [{ pinned: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
  });

  const enriched = projects.map((project) => {
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
    return { ...rest, milestones, planSteps: steps };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  let categoryId = body.categoryId || null;
  if (!categoryId && body.category) {
    const cat = await getOrCreateProjectCategory(body.category);
    categoryId = cat?.id ?? null;
  }
  const maxOrder = await prisma.project.aggregate({ _max: { sortOrder: true } });
  const project = await prisma.project.create({
    data: {
      name: body.name,
      description: body.description || null,
      status: body.status || "PLANNING",
      priority: body.priority || "MEDIUM",
      startDate: body.startDate ? new Date(body.startDate) : null,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      progress: body.progress ?? 0,
      tags: JSON.stringify(body.tags || []),
      goalId: body.goalId || null,
      categoryId,
      ideaDate: body.ideaDate ? new Date(body.ideaDate) : null,
      archiveDate: body.archiveDate ? new Date(body.archiveDate) : null,
      wishFinishTime: body.wishFinishTime || null,
      sortOrder: body.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    },
    include: { category: true },
  });
  return NextResponse.json(project, { status: 201 });
}
