import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProjectProgress } from "@/lib/reminders";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const existing = await prisma.projectMilestone.findUnique({
    where: { id },
    select: { childProjectId: true, projectId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.childProjectId && body.title !== undefined) {
    return NextResponse.json({ error: "子项目里程碑不能修改标题" }, { status: 400 });
  }

  const milestone = await prisma.projectMilestone.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.dueDate !== undefined && {
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      }),
      ...(body.completed !== undefined && { completed: body.completed }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    },
    include: {
      childProject: {
        select: { id: true, name: true, status: true, progress: true, targetDate: true },
      },
    },
  });

  if (existing.childProjectId && body.completed !== undefined) {
    await prisma.project.update({
      where: { id: existing.childProjectId },
      data: { status: body.completed ? "COMPLETED" : "ACTIVE" },
    });
  }

  await syncProjectProgress(prisma, milestone.projectId);
  return NextResponse.json(milestone);
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const milestone = await prisma.projectMilestone.delete({ where: { id } });
  await syncProjectProgress(prisma, milestone.projectId);
  return NextResponse.json({ ok: true });
}
