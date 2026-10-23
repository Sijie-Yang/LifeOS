import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProjectProgress } from "@/lib/reminders";
import { validateSubProjectLink } from "@/lib/project-subprojects";

const childProjectSelect = {
  id: true,
  name: true,
  status: true,
  progress: true,
  targetDate: true,
  category: { select: { name: true, color: true } },
} as const;

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const milestones = await prisma.projectMilestone.findMany({
    where: { projectId: id },
    orderBy: { sortOrder: "asc" },
    include: { childProject: { select: childProjectSelect } },
  });
  return NextResponse.json(milestones);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const count = await prisma.projectMilestone.count({ where: { projectId: id } });

  if (body.childProjectId) {
    const err = await validateSubProjectLink(prisma, id, body.childProjectId);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const child = await prisma.project.findUnique({
      where: { id: body.childProjectId },
      select: { name: true, targetDate: true, status: true },
    });
    if (!child) return NextResponse.json({ error: "子项目不存在" }, { status: 404 });

    const milestone = await prisma.projectMilestone.create({
      data: {
        projectId: id,
        title: child.name,
        dueDate: child.targetDate,
        completed: child.status === "COMPLETED",
        childProjectId: body.childProjectId,
        sortOrder: body.sortOrder ?? count,
      },
      include: { childProject: { select: childProjectSelect } },
    });
    await syncProjectProgress(prisma, id);
    return NextResponse.json(milestone, { status: 201 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }

  const milestone = await prisma.projectMilestone.create({
    data: {
      projectId: id,
      title: body.title.trim(),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      sortOrder: body.sortOrder ?? count,
    },
    include: { childProject: { select: childProjectSelect } },
  });
  await syncProjectProgress(prisma, id);
  return NextResponse.json(milestone, { status: 201 });
}
