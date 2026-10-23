import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const body = await request.json();
  const orderedIds = body.orderedIds as string[] | undefined;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds 无效" }, { status: 400 });
  }

  const existing = await prisma.projectMilestone.findMany({
    where: { projectId },
    select: { id: true },
  });

  if (existing.length !== orderedIds.length) {
    return NextResponse.json({ error: "里程碑数量不匹配" }, { status: 400 });
  }

  const existingIds = new Set(existing.map((m) => m.id));
  if (!orderedIds.every((mid) => existingIds.has(mid))) {
    return NextResponse.json({ error: "包含无效的里程碑 ID" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedIds.map((milestoneId, index) =>
      prisma.projectMilestone.update({
        where: { id: milestoneId },
        data: { sortOrder: index },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
