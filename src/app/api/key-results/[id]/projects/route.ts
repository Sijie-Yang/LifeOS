import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const kr = await prisma.goalKeyResult.findUnique({
    where: { id },
    include: { goal: { select: { id: true } } },
  });
  if (!kr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await prisma.project.findUnique({
    where: { id: body.projectId },
    select: { id: true, goalId: true, name: true, progress: true, status: true, archiveDate: true },
  });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (project.goalId !== kr.goal.id) {
    return NextResponse.json({ error: "只能关联同一目标下的项目" }, { status: 400 });
  }

  const existing = await prisma.goalKeyResultProject.findUnique({
    where: { keyResultId_projectId: { keyResultId: id, projectId: body.projectId } },
  });
  if (existing) return NextResponse.json({ error: "项目已关联" }, { status: 400 });

  const link = await prisma.goalKeyResultProject.create({
    data: { keyResultId: id, projectId: body.projectId },
    include: {
      project: { select: { id: true, name: true, progress: true, status: true, archiveDate: true } },
    },
  });

  return NextResponse.json(link, { status: 201 });
}
