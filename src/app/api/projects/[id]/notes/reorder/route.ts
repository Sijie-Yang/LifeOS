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

  const existing = await prisma.note.findMany({
    where: { projectId },
    select: { id: true },
  });

  if (existing.length !== orderedIds.length) {
    return NextResponse.json({ error: "笔记数量不匹配" }, { status: 400 });
  }

  const existingIds = new Set(existing.map((n) => n.id));
  if (!orderedIds.every((nid) => existingIds.has(nid))) {
    return NextResponse.json({ error: "包含无效的笔记 ID" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedIds.map((noteId, index) =>
      prisma.note.update({
        where: { id: noteId },
        data: { sortOrder: index },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
