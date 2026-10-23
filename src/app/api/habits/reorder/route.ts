import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const orderedIds = body.orderedIds as string[] | undefined;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: "orderedIds 无效" }, { status: 400 });
  }

  const existing = await prisma.habit.findMany({ select: { id: true } });

  if (existing.length !== orderedIds.length) {
    return NextResponse.json({ error: "习惯数量不匹配" }, { status: 400 });
  }

  const existingIds = new Set(existing.map((h) => h.id));
  if (!orderedIds.every((id) => existingIds.has(id))) {
    return NextResponse.json({ error: "包含无效的习惯 ID" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedIds.map((habitId, index) =>
      prisma.habit.update({
        where: { id: habitId },
        data: { sortOrder: index },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
