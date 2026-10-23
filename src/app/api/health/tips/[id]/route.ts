import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HEALTH_TIP_CATEGORIES, mapHealthTip } from "@/lib/health";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  if (
    body.category !== undefined &&
    !HEALTH_TIP_CATEGORIES.includes(body.category as (typeof HEALTH_TIP_CATEGORIES)[number])
  ) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  const tip = await prisma.healthTip.update({
    where: { id },
    data: {
      ...(body.category !== undefined && { category: String(body.category) }),
      ...(body.title !== undefined && { title: String(body.title).trim() }),
      ...(body.content !== undefined && { content: String(body.content).trim() }),
      ...(body.pinned !== undefined && { pinned: Boolean(body.pinned) }),
      ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
    },
  });

  return NextResponse.json(mapHealthTip(tip));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.healthTip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
