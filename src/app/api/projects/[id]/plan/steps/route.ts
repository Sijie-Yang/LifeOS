import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProjectProgress } from "@/lib/reminders";

type Params = { params: Promise<{ id: string }> };

type StepInput = {
  id?: string;
  title: string;
  detail?: string | null;
  estMinutes?: number | null;
  milestoneId?: string | null;
  sortOrder?: number;
  done?: boolean;
  doneDate?: string | null;
  scheduledDate?: string | null;
  isMilestone?: boolean;
};

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      category: { select: { color: true } },
      planSteps: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const steps = (body.steps ?? []) as StepInput[];
  const replace = body.replace !== false;

  const projectUpdate: {
    planActive?: boolean;
    planAnchorDate?: string | null;
    planWorkdays?: string;
  } = {};

  if (body.planActive !== undefined) projectUpdate.planActive = Boolean(body.planActive);
  if (body.planAnchorDate !== undefined) projectUpdate.planAnchorDate = body.planAnchorDate || null;
  if (body.planWorkdays !== undefined) {
    projectUpdate.planWorkdays =
      typeof body.planWorkdays === "string"
        ? body.planWorkdays
        : JSON.stringify(body.planWorkdays);
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(projectUpdate).length > 0) {
      await tx.project.update({ where: { id }, data: projectUpdate });
    }

    if (replace) {
      await tx.projectPlanStep.deleteMany({ where: { projectId: id } });
    }

    const startOrder = replace
      ? 0
      : await tx.projectPlanStep.count({ where: { projectId: id } });

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.id && !replace) {
        await tx.projectPlanStep.update({
          where: { id: s.id },
          data: {
            title: s.title,
            detail: s.detail ?? null,
            estMinutes: s.estMinutes ?? null,
            milestoneId: s.milestoneId ?? null,
            sortOrder: s.sortOrder ?? startOrder + i,
            done: s.done ?? false,
            doneDate: s.doneDate ?? null,
            scheduledDate: s.scheduledDate ?? null,
            isMilestone: s.isMilestone ?? false,
          },
        });
      } else {
        await tx.projectPlanStep.create({
          data: {
            projectId: id,
            title: s.title,
            detail: s.detail ?? null,
            estMinutes: s.estMinutes ?? null,
            milestoneId: s.milestoneId ?? null,
            sortOrder: s.sortOrder ?? startOrder + i,
            done: s.done ?? false,
            doneDate: s.doneDate ?? null,
            scheduledDate: s.scheduledDate ?? null,
            isMilestone: s.isMilestone ?? false,
          },
        });
      }
    }
  });

  await syncProjectProgress(prisma, id);

  const updated = await prisma.project.findUnique({
    where: { id },
    include: {
      planSteps: { orderBy: { sortOrder: "asc" } },
      category: { select: { color: true } },
    },
  });

  return NextResponse.json(updated);
}
