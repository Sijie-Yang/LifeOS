import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const category = await prisma.urgeCategory.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.isPrivate !== undefined && { isPrivate: Boolean(body.isPrivate) }),
      ...(body.goal !== undefined && { goal: body.goal?.trim() || null }),
      ...(body.isActive !== undefined && { isActive: Boolean(body.isActive) }),
    },
  });

  return NextResponse.json(category);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.urgeCategory.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json({ ok: true });
}
