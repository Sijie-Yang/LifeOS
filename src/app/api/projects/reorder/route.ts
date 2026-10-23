import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const orderedIds = body.orderedIds as string[] | undefined;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds 无效" }, { status: 400 });
  }

  const existing = await prisma.project.findMany({ select: { id: true } });
  const existingIds = new Set(existing.map((project) => project.id));
  if (!orderedIds.every((id) => existingIds.has(id))) {
    return NextResponse.json({ error: "包含无效的项目 ID" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.project.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
